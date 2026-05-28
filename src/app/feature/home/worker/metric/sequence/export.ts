import {createAttractorTracker, finalizeActiveAttractor, observeAttractorFrame} from './attractor';
import {createExtinctionTracker, finalizeExtinctionTracker, observeExtinctionMetric} from './extinction';
import {DownloadFrameRange} from '../../../model/download';
import {RecordingManifest} from '../../../model/recording';
import {GOLT_TEMP_METRICS_DIR, openTempOpfsDirectory} from '../../../util/opfs-temp';
import {iterateRecordedFrames, PackedRecordedFrame, RecordingFrameSelection, resolveRecordingFrameSelection} from '../../frame/recording-frame-stream';
import {ByteSink} from '../../snapshot/golt-types';
import {STREAM_REPACK_BLOCK_BYTES} from '../../snapshot/packed-repack';
import {ZipWriter} from '../../zip/zip-writer';
import {buildMetricsCsv, buildMetricsCsvHeader, buildMetricsCsvRow} from '../core/csv';
import {buildMetricsJson} from '../core/json';
import {computeOfflineMetricEntryAsync, createPreviousOfflineMetricFrame, OfflineMetricComputeOptions, OfflineMetricsTribe, PreviousOfflineMetricFrame} from '../core/offline';
import {OfflineMetricEntry} from '../core/offline-types';
import {RecordedGpuMetricBackend} from '../gpu/recorded-gpu-metrics';

import {Grid} from '~gol/feature/home/model/grid';

/**
 * Metrics export progress update.
 *
 * @export
 * @interface MetricsExportProgress
 * @typedef {MetricsExportProgress}
 */
interface MetricsExportProgress {
  /**
   * Metrics phase percent.
   *
   * @type {number}
   */
  percent: number;
  /**
   * Metrics phase status.
   *
   * @type {string}
   */
  status: string;
}

/**
 * Metrics export options.
 *
 * @export
 * @interface MetricsExportOptions
 * @typedef {MetricsExportOptions}
 */
interface MetricsExportOptions {
  /**
   * Throws or reports cancellation through the caller when true.
   *
   * @type {() => boolean}
   */
  shouldCancel: () => boolean;
  /**
   * Receives determinate metrics progress.
   *
   * @type {(progress: MetricsExportProgress) => void}
   */
  onProgress: (progress: MetricsExportProgress) => void;
  /**
   * Receives visible Metrics export warnings.
   *
   * @type {(message: string) => void}
   */
  onWarning: (message: string) => void;
  /**
   * Streams Metrics output rows instead of retaining them in memory.
   *
   * @type {boolean}
   */
  streamEntries: boolean;
}

/**
 * Metrics row-level progress reporter.
 *
 * @export
 * @param {number} rowsProcessed rows processed for the current frame.
 * @param {number} rowsTotal total rows in the current frame.
 */
type MetricsFrameProgressReporter = (rowsProcessed: number, rowsTotal: number) => void;

/**
 * Per-frame Metrics export writer.
 *
 * @export
 * @interface MetricsFrameExportWriter
 * @typedef {MetricsFrameExportWriter}
 */
interface MetricsFrameExportWriter {
  /**
   * Computes and records Metrics for one frame.
   *
   * @param {PackedRecordedFrame} frame packed recorded frame.
   * @param {MetricsFrameProgressReporter} [onProgress] row progress reporter.
   * @returns {Promise<void>} promise resolved after the frame is processed.
   */
  writeFrame(frame: PackedRecordedFrame, onProgress?: MetricsFrameProgressReporter): Promise<void>;
  /**
   * Writes final Metrics ZIP entries.
   *
   * @returns {Promise<void>} promise resolved after output entries are written.
   */
  finish(): Promise<void>;
  /**
   * Releases retained resources.
   *
   * @returns {Promise<void>} promise resolved after resources are released.
   */
  dispose(): Promise<void>;
}

/**
 * Mutable GPU backend holder used when a failed backend is retired.
 *
 * @interface RecordedGpuMetricBackendState
 * @typedef {RecordedGpuMetricBackendState}
 */
interface RecordedGpuMetricBackendState {
  /**
   * Active recorded-frame GPU Metrics backend.
   *
   * @type {(RecordedGpuMetricBackend | null)}
   */
  backend: RecordedGpuMetricBackend | null;
}

/**
 * Temporary OPFS resources for streaming Metrics output.
 *
 * @interface StreamingMetricsFrameExportResources
 * @typedef {StreamingMetricsFrameExportResources}
 */
interface StreamingMetricsFrameExportResources {
  /**
   * Temporary Metrics directory.
   *
   * @type {FileSystemDirectoryHandle}
   */
  directory: FileSystemDirectoryHandle;
  /**
   * Temporary CSV file handle.
   *
   * @type {FileSystemFileHandle}
   */
  fileHandle: FileSystemFileHandle;
  /**
   * Temporary CSV writable stream.
   *
   * @type {FileSystemWritableFileStream}
   */
  writable: FileSystemWritableFileStream;
  /**
   * Temporary CSV filename.
   *
   * @type {string}
   */
  filename: string;
}

/**
 * Text encoder for Metrics ZIP entries.
 *
 * @type {TextEncoder}
 */
const TEXT_ENCODER = new TextEncoder();

/**
 * Status label used while Metrics rows are computed.
 *
 * @type {string}
 */
const COMPUTING_METRICS_STATUS = 'Computing metrics';

/**
 * Writes Metrics CSV and JSON entries to the ZIP archive.
 *
 * @export
 * @async
 * @param {ZipWriter} zip zip writer.
 * @param {Grid & {manifest: RecordingManifest}} recording recording dimensions and manifest.
 * @param {(DownloadFrameRange | null)} frameRange selected UI frame range.
 * @param {readonly OfflineMetricsTribe[]} tribes ordered tribe metadata.
 * @param {MetricsExportOptions} options export options.
 */
async function writeMetricsEntries(zip: ZipWriter, recording: Grid & {manifest: RecordingManifest}, frameRange: DownloadFrameRange | null, tribes: readonly OfflineMetricsTribe[], options: MetricsExportOptions): Promise<void> {
  const selection = resolveRecordingFrameSelection(recording.manifest, frameRange);
  const writer = await createMetricsExportWriter(zip, recording, selection, tribes, options);
  console.log('[GOLT] Metrics export started', {
    selectedStartFrame: selection.selectedStartFrame,
    selectedEndFrame: selection.selectedEndFrame,
    selectedFrameCount: selection.framesTotal,
    streamEntries: options.streamEntries
  });
  options.onProgress({percent: 0, status: 'Reading recorded frames'});
  try {
    for await (const frame of iterateRecordedFrames(recording, frameRange, {
      shouldCancel: options.shouldCancel,
      onProgress: progress => {
        const percent = progress.framesTotal > 0 ? Math.min(80, Math.round((writer.framesCompleted / progress.framesTotal) * 80)) : 0;
        options.onProgress({
          percent,
          status: COMPUTING_METRICS_STATUS
        });
      }
    })) {
      await writer.writeFrame(frame);
    }
    await writer.finish();
    options.onProgress({percent: 100, status: 'Metrics complete'});
  } finally {
    await writer.dispose();
  }
}

/**
 * Creates a per-frame Metrics export writer.
 *
 * @export
 * @async
 * @param {ZipWriter} zip target ZIP writer.
 * @param {Grid & {manifest: RecordingManifest}} recording recording dimensions and manifest.
 * @param {RecordingFrameSelection} selection selected frame range.
 * @param {readonly OfflineMetricsTribe[]} tribes ordered tribe metadata.
 * @param {MetricsExportOptions} options export options.
 * @returns {Promise<MetricsFrameExportWriter & {readonly framesCompleted: number}>} Metrics writer.
 */
async function createMetricsExportWriter(
  zip: ZipWriter,
  recording: Grid & {manifest: RecordingManifest},
  selection: RecordingFrameSelection,
  tribes: readonly OfflineMetricsTribe[],
  options: MetricsExportOptions
): Promise<MetricsFrameExportWriter & {readonly framesCompleted: number}> {
  const gpuBackend = await createRecordedGpuMetricBackend();
  let writer: MetricsFrameExportWriter & {readonly framesCompleted: number};
  if (options.streamEntries) {
    writer = await StreamingMetricsFrameExportWriter.create(zip, recording, selection, tribes, options, gpuBackend);
  } else {
    writer = new BufferedMetricsFrameExportWriter(zip, recording, selection, tribes, options, gpuBackend);
  }
  return writer;
}

/**
 * Shared Metrics writer state and frame processing.
 *
 * @abstract
 * @class BaseMetricsFrameExportWriter
 * @typedef {BaseMetricsFrameExportWriter}
 * @implements {MetricsFrameExportWriter}
 */
abstract class BaseMetricsFrameExportWriter implements MetricsFrameExportWriter {
  /**
   * Attractor episode tracker.
   *
   * @protected
   * @readonly
   * @type {ReturnType<typeof createAttractorTracker>}
   */
  protected readonly attractorTracker = createAttractorTracker();

  /**
   * Extinction episode tracker.
   *
   * @protected
   * @readonly
   * @type {ReturnType<typeof createExtinctionTracker>}
   */
  protected readonly extinctionTracker: ReturnType<typeof createExtinctionTracker>;

  /**
   * Previously processed frame state.
   *
   * @protected
   * @type {(PreviousOfflineMetricFrame | null)}
   */
  protected previous: PreviousOfflineMetricFrame | null = null;

  /**
   * Completed Metrics frame count.
   *
   * @protected
   * @type {number}
   */
  protected metricsFramesCompleted = 0;

  /**
   * Completed Metrics frame count.
   *
   * @public
   * @readonly
   * @type {number}
   */
  public get framesCompleted(): number {
    return this.metricsFramesCompleted;
  }

  /**
   * Creates a shared Metrics frame writer.
   *
   * @param {ZipWriter} zip target ZIP writer.
   * @param {Grid & {manifest: RecordingManifest}} recording recording dimensions and manifest.
   * @param {RecordingFrameSelection} selection selected frame range.
   * @param {readonly OfflineMetricsTribe[]} tribes ordered tribe metadata.
   * @param {MetricsExportOptions} options export options.
   * @param {(RecordedGpuMetricBackend | null)} gpuBackend gpu backend, if available.
   */
  public constructor(
    protected readonly zip: ZipWriter,
    protected readonly recording: Grid & {manifest: RecordingManifest},
    protected readonly selection: RecordingFrameSelection,
    protected readonly tribes: readonly OfflineMetricsTribe[],
    protected readonly options: MetricsExportOptions,
    protected gpuBackend: RecordedGpuMetricBackend | null
  ) {
    this.extinctionTracker = createExtinctionTracker(tribes);
  }

  /**
   * Computes and stores Metrics for one frame.
   *
   * @public
   * @async
   * @param {PackedRecordedFrame} frame packed recorded frame.
   * @param {MetricsFrameProgressReporter} [onProgress] row progress reporter.
   */
  public async writeFrame(frame: PackedRecordedFrame, onProgress?: MetricsFrameProgressReporter): Promise<void> {
    assertNotCancelled(this.options);
    const state = {backend: this.gpuBackend};
    const metric = await computeMetricWithFallback(frame, this.tribes, this.previous, createMetricComputeOptions(this.metricsFramesCompleted, this.selection.framesTotal, this.options, onProgress), state, this.options.onWarning);
    this.gpuBackend = state.backend;
    observeAttractorFrame(this.attractorTracker, frame, metric);
    observeExtinctionMetric(this.extinctionTracker, metric);
    await this.storeMetric(metric);
    this.previous = createPreviousOfflineMetricFrame(frame, metric);
    this.metricsFramesCompleted++;
  }

  /**
   * Writes final Metrics outputs.
   *
   * @public
   * @async
   */
  public async finish(): Promise<void> {
    assertNotCancelled(this.options);
    finalizeActiveAttractor(this.attractorTracker);
    finalizeExtinctionTracker(this.extinctionTracker);
    await this.writeOutputs();
    console.log('[GOLT] Metrics export finished', {
      metricRows: this.metricsFramesCompleted,
      generationGapCount: this.attractorTracker.generationGapCount,
      attractorCount: this.attractorTracker.attractors.length,
      streamEntries: this.options.streamEntries
    });
  }

  /**
   * Releases retained resources.
   *
   * @public
   * @async
   */
  public async dispose(): Promise<void> {
    this.gpuBackend?.dispose();
  }

  /**
   * Stores one computed metric row.
   *
   * @protected
   * @abstract
   * @param {OfflineMetricEntry} metric computed metric row.
   * @returns {Promise<void>} promise resolved after the row is stored.
   */
  protected abstract storeMetric(metric: OfflineMetricEntry): Promise<void>;

  /**
   * Writes final Metrics ZIP outputs.
   *
   * @protected
   * @abstract
   * @returns {Promise<void>} promise resolved after outputs are written.
   */
  protected abstract writeOutputs(): Promise<void>;
}

/**
 * In-memory Metrics frame writer.
 *
 * @class BufferedMetricsFrameExportWriter
 * @typedef {BufferedMetricsFrameExportWriter}
 * @extends {BaseMetricsFrameExportWriter}
 */
class BufferedMetricsFrameExportWriter extends BaseMetricsFrameExportWriter {
  /**
   * Retained metric rows.
   *
   * @private
   * @readonly
   * @type {OfflineMetricEntry[]}
   */
  private readonly metrics: OfflineMetricEntry[] = [];

  /**
   * Stores one computed metric row in memory.
   *
   * @protected
   * @async
   * @param {OfflineMetricEntry} metric computed metric row.
   */
  protected async storeMetric(metric: OfflineMetricEntry): Promise<void> {
    this.metrics.push(metric);
  }

  /**
   * Writes buffered Metrics CSV and JSON entries.
   *
   * @protected
   * @async
   */
  protected async writeOutputs(): Promise<void> {
    this.options.onProgress({percent: 88, status: 'Writing metrics CSV'});
    await this.zip.addEntry('metrics.csv', entry => entry.write(TEXT_ENCODER.encode(buildMetricsCsv(this.metrics, this.tribes))));
    assertNotCancelled(this.options);
    this.options.onProgress({percent: 94, status: 'Writing metrics summary'});
    await this.zip.addEntry('metrics.json', entry => entry.write(TEXT_ENCODER.encode(buildMetricsJson(this.metrics, {
      cols: this.recording.cols,
      rows: this.recording.rows,
      selectedStartFrame: this.selection.selectedStartFrame,
      selectedEndFrame: this.selection.selectedEndFrame,
      selectedFrameCount: this.selection.framesTotal,
      generationGapCount: this.attractorTracker.generationGapCount,
      attractors: this.attractorTracker.attractors,
      extinctions: this.extinctionTracker.extinctions
    }))));
  }
}

/**
 * OPFS-backed streaming Metrics frame writer.
 *
 * @class StreamingMetricsFrameExportWriter
 * @typedef {StreamingMetricsFrameExportWriter}
 * @extends {BaseMetricsFrameExportWriter}
 */
class StreamingMetricsFrameExportWriter extends BaseMetricsFrameExportWriter {
  /**
   * Temporary Metrics directory.
   *
   * @private
   * @readonly
   * @type {FileSystemDirectoryHandle}
   */
  private readonly directory: FileSystemDirectoryHandle;

  /**
   * Temporary CSV file handle.
   *
   * @private
   * @readonly
   * @type {FileSystemFileHandle}
   */
  private readonly fileHandle: FileSystemFileHandle;

  /**
   * Temporary CSV writable stream.
   *
   * @private
   * @readonly
   * @type {FileSystemWritableFileStream}
   */
  private readonly writable: FileSystemWritableFileStream;

  /**
   * Temporary CSV filename.
   *
   * @private
   * @readonly
   * @type {string}
   */
  private readonly filename: string;

  /**
   * Buffered text writer for the temporary CSV file.
   *
   * @private
   * @readonly
   * @type {ReturnType<typeof createBufferedTextEntryWriter>}
   */
  private readonly csvWriter: ReturnType<typeof createBufferedTextEntryWriter>;

  /**
   * First streamed metric row.
   *
   * @private
   * @type {(OfflineMetricEntry | null)}
   */
  private firstMetric: OfflineMetricEntry | null = null;

  /**
   * Last streamed metric row.
   *
   * @private
   * @type {(OfflineMetricEntry | null)}
   */
  private lastMetric: OfflineMetricEntry | null = null;

  /**
   * Whether the temporary CSV stream has been closed.
   *
   * @private
   * @type {boolean}
   */
  private csvClosed = false;

  /**
   * Whether the temporary CSV file has been removed.
   *
   * @private
   * @type {boolean}
   */
  private tempRemoved = false;

  /**
   * Creates a streaming Metrics writer.
   *
   * @param {ZipWriter} zip target ZIP writer.
   * @param {Grid & {manifest: RecordingManifest}} recording recording dimensions and manifest.
   * @param {RecordingFrameSelection} selection selected frame range.
   * @param {readonly OfflineMetricsTribe[]} tribes ordered tribe metadata.
   * @param {MetricsExportOptions} options export options.
   * @param {(RecordedGpuMetricBackend | null)} gpuBackend gpu backend, if available.
   * @param {StreamingMetricsFrameExportResources} resources temporary OPFS resources.
   */
  private constructor(
    zip: ZipWriter,
    recording: Grid & {manifest: RecordingManifest},
    selection: RecordingFrameSelection,
    tribes: readonly OfflineMetricsTribe[],
    options: MetricsExportOptions,
    gpuBackend: RecordedGpuMetricBackend | null,
    resources: StreamingMetricsFrameExportResources
  ) {
    super(zip, recording, selection, tribes, options, gpuBackend);
    this.directory = resources.directory;
    this.fileHandle = resources.fileHandle;
    this.writable = resources.writable;
    this.filename = resources.filename;
    this.csvWriter = createBufferedTextEntryWriter({
      write: async chunk => {
        await this.writable.write(chunk);
      }
    });
  }

  /**
   * Creates an OPFS-backed streaming Metrics writer.
   *
   * @public
   * @static
   * @async
   * @param {ZipWriter} zip target ZIP writer.
   * @param {Grid & {manifest: RecordingManifest}} recording recording dimensions and manifest.
   * @param {RecordingFrameSelection} selection selected frame range.
   * @param {readonly OfflineMetricsTribe[]} tribes ordered tribe metadata.
   * @param {MetricsExportOptions} options export options.
   * @param {(RecordedGpuMetricBackend | null)} gpuBackend gpu backend, if available.
   * @returns {Promise<StreamingMetricsFrameExportWriter>} streaming writer.
   */
  public static async create(
    zip: ZipWriter,
    recording: Grid & {manifest: RecordingManifest},
    selection: RecordingFrameSelection,
    tribes: readonly OfflineMetricsTribe[],
    options: MetricsExportOptions,
    gpuBackend: RecordedGpuMetricBackend | null
  ): Promise<StreamingMetricsFrameExportWriter> {
    const directory = await openTempOpfsDirectory(GOLT_TEMP_METRICS_DIR);
    const filename = createUniqueMetricsTempFilename();
    const fileHandle = await directory.getFileHandle(filename, {create: true});
    const writable = await fileHandle.createWritable();
    const writer = new StreamingMetricsFrameExportWriter(zip, recording, selection, tribes, options, gpuBackend, {
      directory,
      fileHandle,
      writable,
      filename
    });
    await writer.csvWriter.writeLine(buildMetricsCsvHeader(tribes));
    return writer;
  }

  /**
   * Releases GPU and OPFS resources.
   *
   * @public
   * @async
   */
  public override async dispose(): Promise<void> {
    await super.dispose();
    if (!this.csvClosed) {
      try {
        await this.writable.abort();
      } catch (error) {
        console.warn('[GOLT] Failed to abort temporary Metrics CSV stream:', error);
      }
    }
    await this.removeTempFile();
  }

  /**
   * Stores one computed metric row in the temporary CSV file.
   *
   * @protected
   * @async
   * @param {OfflineMetricEntry} metric computed metric row.
   */
  protected async storeMetric(metric: OfflineMetricEntry): Promise<void> {
    this.firstMetric ??= metric;
    this.lastMetric = metric;
    await this.csvWriter.writeLine(buildMetricsCsvRow(metric, this.tribes));
  }

  /**
   * Writes streamed Metrics CSV and JSON entries.
   *
   * @protected
   * @async
   */
  protected async writeOutputs(): Promise<void> {
    await this.closeCsv();
    this.options.onProgress({percent: 88, status: 'Writing metrics CSV'});
    await this.zip.addEntry('metrics.csv', async entry => {
      const file = await this.fileHandle.getFile();
      const reader = file.stream().getReader();
      let done = false;
      while (!done) {
        assertNotCancelled(this.options);
        const result = await reader.read();
        done = result.done;
        if (!done && result.value) {
          await entry.write(result.value);
        }
      }
    });
    assertNotCancelled(this.options);
    await this.removeTempFile();
    this.options.onProgress({percent: 94, status: 'Writing metrics summary'});
    await this.zip.addEntry('metrics.json', entry => entry.write(TEXT_ENCODER.encode(buildMetricsJsonSummary(
      this.firstMetric,
      this.lastMetric,
      this.metricsFramesCompleted,
      this.recording,
      this.selection,
      this.attractorTracker,
      this.extinctionTracker
    ))));
  }

  /**
   * Closes the temporary CSV stream.
   *
   * @private
   * @async
   */
  private async closeCsv(): Promise<void> {
    if (!this.csvClosed) {
      await this.csvWriter.flush();
      await this.writable.close();
      this.csvClosed = true;
    }
  }

  /**
   * Removes the temporary CSV file.
   *
   * @private
   * @async
   */
  private async removeTempFile(): Promise<void> {
    if (!this.tempRemoved) {
      this.tempRemoved = true;
      try {
        await this.directory.removeEntry(this.filename);
      } catch (error) {
        if (!isMissingOpfsEntry(error)) {
          console.warn('[GOLT] Failed to remove temporary Metrics CSV file:', this.filename, error);
        }
      }
    }
  }
}

/**
 * Creates compute options for one metric frame.
 *
 * @param {number} completedBeforeFrame completed frame count before this frame.
 * @param {number} framesTotal selected frame count.
 * @param {MetricsExportOptions} options export options.
 * @param {MetricsFrameProgressReporter} [onProgress] row progress reporter.
 * @returns {OfflineMetricComputeOptions} compute options.
 */
function createMetricComputeOptions(completedBeforeFrame: number, framesTotal: number, options: MetricsExportOptions, onProgress?: MetricsFrameProgressReporter): OfflineMetricComputeOptions {
  return {
    shouldCancel: options.shouldCancel,
    onRowsProcessed: (rowsProcessed, rowsTotal) => {
      if (onProgress) {
        onProgress(rowsProcessed, rowsTotal);
      } else {
        const frameFraction = rowsTotal > 0 ? rowsProcessed / rowsTotal : 1;
        const percent = framesTotal > 0 ? Math.min(80, Math.round(((completedBeforeFrame + frameFraction) / framesTotal) * 80)) : 0;
        options.onProgress({
          percent,
          status: COMPUTING_METRICS_STATUS
        });
      }
    }
  };
}

/**
 * Creates a buffered line writer for streamed text entries.
 *
 * @param {ByteSink} sink byte sink.
 * @returns {{writeLine: (line: string) => Promise<void>; flush: () => Promise<void>}} buffered line writer.
 */
function createBufferedTextEntryWriter(sink: ByteSink): {writeLine: (line: string) => Promise<void>; flush: () => Promise<void>} {
  let pending = '';
  let pendingBytesEstimate = 0;
  const flush = async(): Promise<void> => {
    if (pending.length > 0) {
      await sink.write(TEXT_ENCODER.encode(pending));
      pending = '';
      pendingBytesEstimate = 0;
    }
  };
  return {
    writeLine: async line => {
      pending += `${line}\n`;
      pendingBytesEstimate += line.length + 1;
      if (pendingBytesEstimate >= STREAM_REPACK_BLOCK_BYTES) {
        await flush();
      }
    },
    flush
  };
}

/**
 * Builds the streaming Metrics JSON summary document.
 *
 * @param {(OfflineMetricEntry | null)} firstMetric first metric row.
 * @param {(OfflineMetricEntry | null)} lastMetric last metric row.
 * @param {number} frameCount number of streamed metric rows.
 * @param {Grid & {manifest: RecordingManifest}} recording recording dimensions and manifest.
 * @param {RecordingFrameSelection} selection resolved frame selection.
 * @param {ReturnType<typeof createAttractorTracker>} attractorTracker attractor tracker.
 * @param {ReturnType<typeof createExtinctionTracker>} extinctionTracker extinction tracker.
 * @returns {string} JSON document.
 */
function buildMetricsJsonSummary(
  firstMetric: OfflineMetricEntry | null,
  lastMetric: OfflineMetricEntry | null,
  frameCount: number,
  recording: Grid & {manifest: RecordingManifest},
  selection: RecordingFrameSelection,
  attractorTracker: ReturnType<typeof createAttractorTracker>,
  extinctionTracker: ReturnType<typeof createExtinctionTracker>
): string {
  return JSON.stringify({
    generationStart: firstMetric?.generation ?? null,
    generationEnd: lastMetric?.generation ?? null,
    frameCount,
    cols: recording.cols,
    rows: recording.rows,
    selectedStartFrame: selection.selectedStartFrame,
    selectedEndFrame: selection.selectedEndFrame,
    selectedFrameCount: selection.framesTotal,
    generationGapCount: attractorTracker.generationGapCount,
    attractors: attractorTracker.attractors,
    extinctions: extinctionTracker.extinctions
  }, null, 2);
}

/**
 * Creates the recorded-frame GPU backend when possible.
 *
 * @async
 * @returns {Promise<(RecordedGpuMetricBackend | null)>} GPU backend or null.
 */
async function createRecordedGpuMetricBackend(): Promise<RecordedGpuMetricBackend | null> {
  let backend: RecordedGpuMetricBackend | null;
  try {
    backend = await RecordedGpuMetricBackend.create();
  } catch (error) {
    console.warn('[GOLT] Recorded GPU Metrics unavailable; using TypeScript Metrics', error);
    backend = null;
  }
  return backend;
}

/**
 * Computes one metric row and permanently falls back after a GPU failure.
 *
 * @async
 * @param {Parameters<typeof computeOfflineMetricEntryAsync>[0]} frame packed recorded frame.
 * @param {readonly OfflineMetricsTribe[]} tribes ordered tribe metadata.
 * @param {(PreviousOfflineMetricFrame | null)} previous previous frame state.
 * @param {OfflineMetricComputeOptions} options compute options.
 * @param {RecordedGpuMetricBackendState} gpuBackend recorded GPU backend state.
 * @param {(message: string) => void} onWarning warning receiver.
 * @returns {Promise<OfflineMetricEntry>} metric row.
 */
async function computeMetricWithFallback(
  frame: Parameters<typeof computeOfflineMetricEntryAsync>[0],
  tribes: readonly OfflineMetricsTribe[],
  previous: PreviousOfflineMetricFrame | null,
  options: OfflineMetricComputeOptions,
  gpuBackend: RecordedGpuMetricBackendState,
  onWarning: (message: string) => void
): Promise<OfflineMetricEntry> {
  let metric: OfflineMetricEntry | null = null;
  if (gpuBackend.backend) {
    const unsupportedReason = gpuBackend.backend.unsupportedReason(frame, tribes, previous);
    if (!unsupportedReason) {
      try {
        metric = await gpuBackend.backend.computeFrameMetric(frame, tribes, previous, options);
      } catch (error) {
        console.warn('[GOLT] Recorded GPU Metrics failed; falling back to TypeScript Metrics', error);
        gpuBackend.backend.dispose();
        gpuBackend.backend = null;
      }
    } else {
      const visibleWarning = gpuBackend.backend.warnUnsupported(unsupportedReason);
      if (visibleWarning) {
        onWarning(`${unsupportedReason} Using TypeScript Metrics instead.`);
      } else {
        console.warn(`[GOLT] ${unsupportedReason} Using TypeScript Metrics for this frame.`);
      }
    }
  }
  if (metric === null) {
    metric = await computeOfflineMetricEntryAsync(frame, tribes, previous, options);
  }
  return metric;
}

/**
 * Creates a unique temporary Metrics CSV filename.
 *
 * @returns {string} temporary filename.
 */
function createUniqueMetricsTempFilename(): string {
  const suffix = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Math.random().toString(36).slice(2);
  return `${Date.now()}-${suffix}-metrics.csv`;
}

/**
 * Checks for a missing OPFS entry error.
 *
 * @param {unknown} error error thrown by OPFS.
 * @returns {boolean} true when the entry was already missing.
 */
function isMissingOpfsEntry(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'NotFoundError';
}

/**
 * Throws when Metrics export cancellation has been requested.
 *
 * @param {MetricsExportOptions} options export options.
 */
function assertNotCancelled(options: MetricsExportOptions): void {
  if (options.shouldCancel()) {
    throw new Error('Metrics export cancelled');
  }
}

export {createMetricsExportWriter, writeMetricsEntries};

export type {MetricsExportOptions, MetricsExportProgress, MetricsFrameExportWriter, MetricsFrameProgressReporter};
