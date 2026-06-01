import {BaseMetricsFrameExportWriter} from './base-metrics-frame-export-writer';
import {assertNotCancelled, buildMetricsJsonSummary, createBufferedTextEntryWriter, createUniqueMetricsTempFilename, isMissingOpfsEntry, METRICS_TEXT_ENCODER} from './export-logic';
import {MetricsExportOptions, StreamingMetricsFrameExportResources} from './export-types';
import {openTempOpfsDirectory} from '../../../logic/opfs-temp';
import {Recording} from '../../../model/recording';
import {RecordingFrameSelection} from '../../frame/recording-frame-types';
import {ZipWriter} from '../../zip/zip-writer';
import {buildMetricsCsvHeader, buildMetricsCsvRow} from '../core/csv';
import {OfflineMetricsTribe} from '../core/offline-compute-types';
import {OfflineMetricEntry} from '../core/offline-types';
import {RecordedGpuMetricBackend} from '../gpu/recorded-gpu-metrics';

import {GOLT_TEMP_METRICS_DIR} from '~gol/feature/home/model/opfs';

/**
 * OPFS-backed streaming Metrics frame writer.
 *
 * @class StreamingMetricsFrameExportWriter
 * @typedef {StreamingMetricsFrameExportWriter}
 * @extends {BaseMetricsFrameExportWriter}
 */
export class StreamingMetricsFrameExportWriter extends BaseMetricsFrameExportWriter {
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
   * @param {Recording} recording recording dimensions and manifest.
   * @param {RecordingFrameSelection} selection selected frame range.
   * @param {readonly OfflineMetricsTribe[]} tribes ordered tribe metadata.
   * @param {MetricsExportOptions} options export options.
   * @param {(RecordedGpuMetricBackend | null)} gpuBackend gpu backend, if available.
   * @param {StreamingMetricsFrameExportResources} resources temporary OPFS resources.
   */
  private constructor(
    zip: ZipWriter,
    recording: Recording,
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
   * @param {Recording} recording recording dimensions and manifest.
   * @param {RecordingFrameSelection} selection selected frame range.
   * @param {readonly OfflineMetricsTribe[]} tribes ordered tribe metadata.
   * @param {MetricsExportOptions} options export options.
   * @param {(RecordedGpuMetricBackend | null)} gpuBackend gpu backend, if available.
   * @returns {Promise<StreamingMetricsFrameExportWriter>} streaming writer.
   */
  public static async create(
    zip: ZipWriter,
    recording: Recording,
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
    await this.zip.addEntry('metrics.json', entry => entry.write(METRICS_TEXT_ENCODER.encode(buildMetricsJsonSummary(
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
