import {assertNotCancelled, buildGpuFrameMetricStats, buildRecordedMetricWgsl, createRecordedGpuMetricsDeviceLostError} from './recorded-gpu-metrics-logic';
import {GPU_CONFIG_BYTE_SIZE, GPU_STATE_BUCKETS, GPU_STATS_BYTE_SIZE, RecordedGpuMetricsContext, U32_MAX} from './recorded-gpu-metrics-model';
import {GridFormat} from '../../../model/grid-format';
import {DEAD_TRIBE_ID} from '../../../model/rule';
import {PackedRecordedFrame} from '../../frame/recording-frame-stream';
import {requestWorkerGpuDevice} from '../../gpu/gpu-device';
import {GPU_LABELS} from '../../gpu/gpu-labels';
import {buildOfflineMetricEntry, OfflineMetricComputeOptions, OfflineMetricsTribe, PreviousOfflineMetricFrame} from '../core/offline';
import {OfflineMetricEntry} from '../core/offline-types';

/**
 * Recorded-frame GPU metrics backend.
 *
 * @export
 * @class RecordedGpuMetricBackend
 * @typedef {RecordedGpuMetricBackend}
 */
class RecordedGpuMetricBackend {
  /**
   * Reusable per-export GPU context.
   *
   * @private
   * @type {(RecordedGpuMetricsContext | null)}
   */
  private context: RecordedGpuMetricsContext | null = null;

  /**
   * GPU device loss information, when the backend can no longer be used.
   *
   * @private
   * @type {(GPUDeviceLostInfo | null)}
   */
  private deviceLostInfo: GPUDeviceLostInfo | null = null;

  /**
   * Whether backend disposal intentionally destroyed the device.
   *
   * @private
   * @type {boolean}
   */
  private disposed = false;

  /**
   * GPU unsupported-reason warnings already logged.
   *
   * @private
   * @readonly
   * @type {Set<string>}
   */
  private readonly unsupportedWarnings = new Set<string>();

  /**
   * Creates a recorded-frame GPU metrics backend.
   *
   * @private
   * @param {GPUDevice} device webgpu device.
   */
  private constructor(private readonly device: GPUDevice) {
    this.device.lost.then(info => this.markDeviceLost(info));
  }

  /**
   * Creates a recorded-frame GPU metrics backend when WebGPU is available.
   *
   * @public
   * @static
   * @async
   * @returns {Promise<(RecordedGpuMetricBackend | null)>} GPU backend or null.
   */
  public static async create(): Promise<RecordedGpuMetricBackend | null> {
    const device = await requestWorkerGpuDevice(GPU_LABELS.recordedGpuMetricsDevice);
    return new RecordedGpuMetricBackend(device);
  }

  /**
   * Explains why a frame should skip the GPU backend.
   *
   * @public
   * @param {PackedRecordedFrame} frame packed recorded frame.
   * @param {readonly OfflineMetricsTribe[]} tribes ordered tribe metadata.
   * @param {(PreviousOfflineMetricFrame | null)} previous previous frame state.
   * @returns {(string | null)} unsupported reason, or null when GPU can be used.
   */
  public unsupportedReason(frame: PackedRecordedFrame, tribes: readonly OfflineMetricsTribe[], previous: PreviousOfflineMetricFrame | null): string | null {
    let reason: string | null = null;
    if (tribes.length > GPU_STATE_BUCKETS) {
      reason = `Recorded GPU Metrics supports up to ${GPU_STATE_BUCKETS} states.`;
    } else {
      reason = this.frameLimitReason(frame, previous);
    }
    return reason;
  }

  /**
   * Returns whether the GPU backend can process a frame without exceeding fixed device limits.
   *
   * @public
   * @param {PackedRecordedFrame} frame packed recorded frame.
   * @param {(PreviousOfflineMetricFrame | null)} previous previous frame state.
   * @returns {boolean} whether the frame can be processed on this GPU.
   */
  public canProcessFrame(frame: PackedRecordedFrame, previous: PreviousOfflineMetricFrame | null): boolean {
    return this.frameLimitReason(frame, previous) === null;
  }

  /**
   * Logs a GPU unsupported reason once.
   *
   * @public
   * @param {string} reason unsupported reason.
   * @returns {boolean} whether the reason was newly logged.
   */
  public warnUnsupported(reason: string): boolean {
    let logged = false;
    if (!this.unsupportedWarnings.has(reason)) {
      this.unsupportedWarnings.add(reason);
      console.warn(`[GOLT] ${reason} Using TypeScript Metrics for affected frames.`);
      logged = true;
    }
    return logged;
  }

  /**
   * Returns whether the GPU device has been lost.
   *
   * @public
   * @returns {boolean} whether the device has been lost.
   */
  public isDeviceLost(): boolean {
    return this.deviceLostInfo !== null;
  }

  /**
   * Computes one recorded-frame Metrics row on the GPU.
   *
   * @public
   * @async
   * @param {PackedRecordedFrame} frame packed recorded frame.
   * @param {readonly OfflineMetricsTribe[]} tribes ordered tribe metadata.
   * @param {(PreviousOfflineMetricFrame | null)} previous previous frame state.
   * @param {OfflineMetricComputeOptions} options compute options.
   * @returns {Promise<OfflineMetricEntry>} metric row.
   */
  public async computeFrameMetric(frame: PackedRecordedFrame, tribes: readonly OfflineMetricsTribe[], previous: PreviousOfflineMetricFrame | null, options: OfflineMetricComputeOptions): Promise<OfflineMetricEntry> {
    assertNotCancelled(options);
    this.assertDeviceAvailable();
    const unsupportedReason = this.unsupportedReason(frame, tribes, previous);
    if (unsupportedReason) {
      throw new Error(unsupportedReason);
    }
    const exactTransition = previous !== null && frame.generation - previous.generation === 1;
    const deadIndex = tribes.findIndex(tribe => tribe.id === DEAD_TRIBE_ID);
    this.context ??= this.createContext(frame, previous?.format ?? frame.format, tribes.length, deadIndex);
    const readback = await this.runMetricPass(this.context, frame, previous, exactTransition);
    assertNotCancelled(options);
    return buildOfflineMetricEntry(frame, tribes, previous, buildGpuFrameMetricStats(readback, tribes.length, exactTransition), deadIndex);
  }

  /**
   * Releases the WebGPU device and per-export resources.
   *
   * @public
   */
  public dispose(): void {
    this.disposed = true;
    this.disposeContext();
    this.device.destroy();
  }

  /**
   * Creates the reusable per-export GPU Metrics context.
   *
   * @private
   * @param {PackedRecordedFrame} frame first packed recorded frame.
   * @param {GridFormat} previousFormat previous-frame packing format.
   * @param {number} tribeCount known state count.
   * @param {number} deadIndex dead tribe index.
   * @returns {RecordedGpuMetricsContext} reusable GPU context.
   */
  private createContext(frame: PackedRecordedFrame, previousFormat: GridFormat, tribeCount: number, deadIndex: number): RecordedGpuMetricsContext {
    const frameByteSize = Math.max(Uint32Array.BYTES_PER_ELEMENT, frame.words.byteLength);
    const shader = this.device.createShaderModule({
      label: 'recorded metric shader',
      code: buildRecordedMetricWgsl(frame, previousFormat, tribeCount, deadIndex)
    });
    const pipeline = this.device.createComputePipeline({
      label: 'recorded metric pipeline',
      layout: 'auto',
      compute: {
        module: shader,
        entryPoint: 'main'
      }
    });
    const currentBuffer = this.device.createBuffer({
      label: 'recorded metric current frame',
      size: frameByteSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });
    const previousBuffer = this.device.createBuffer({
      label: 'recorded metric previous frame',
      size: frameByteSize,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
    });
    const statsBuffer = this.device.createBuffer({
      label: 'recorded metric stats',
      size: GPU_STATS_BYTE_SIZE,
      usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
    });
    const readbackBuffer = this.device.createBuffer({
      label: 'recorded metric stats readback',
      size: GPU_STATS_BYTE_SIZE,
      usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
    });
    const configBuffer = this.device.createBuffer({
      label: 'recorded metric config',
      size: GPU_CONFIG_BYTE_SIZE,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
    });
    const bindGroup = this.device.createBindGroup({
      label: 'recorded metric bind group',
      layout: pipeline.getBindGroupLayout(0),
      entries: [
        {binding: 0, resource: {buffer: currentBuffer} },
        {binding: 1, resource: {buffer: previousBuffer} },
        {binding: 2, resource: {buffer: statsBuffer} },
        {binding: 3, resource: {buffer: configBuffer} }
      ]
    });
    return {
      pipeline,
      bindGroup,
      currentBuffer,
      previousBuffer,
      statsBuffer,
      readbackBuffer,
      configBuffer,
      statsByteSize: GPU_STATS_BYTE_SIZE,
      frameByteSize
    };
  }

  /**
   * Runs the recorded-frame GPU metric pass.
   *
   * @private
   * @async
   * @param {RecordedGpuMetricsContext} context reusable GPU context.
   * @param {PackedRecordedFrame} frame packed recorded frame.
   * @param {(PreviousOfflineMetricFrame | null)} previous previous frame state.
   * @param {boolean} exactTransition whether transition counters should be computed.
   * @returns {Promise<Uint32Array>} metric counters.
   */
  private async runMetricPass(context: RecordedGpuMetricsContext, frame: PackedRecordedFrame, previous: PreviousOfflineMetricFrame | null, exactTransition: boolean): Promise<Uint32Array> {
    this.device.queue.writeBuffer(context.currentBuffer, 0, frame.words);
    this.device.queue.writeBuffer(context.previousBuffer, 0, previous?.words ?? frame.words);
    this.device.queue.writeBuffer(context.configBuffer, 0, new Uint32Array([exactTransition ? 1 : 0]));
    const encoder = this.device.createCommandEncoder({label: 'recorded metric encoder'});
    encoder.clearBuffer(context.statsBuffer);
    const pass = encoder.beginComputePass({label: 'recorded metric pass'});
    pass.setPipeline(context.pipeline);
    pass.setBindGroup(0, context.bindGroup);
    pass.dispatchWorkgroups(Math.ceil(frame.cols / 16), Math.ceil(frame.rows / 16));
    pass.end();
    encoder.copyBufferToBuffer(context.statsBuffer, 0, context.readbackBuffer, 0, context.statsByteSize);
    this.device.queue.submit([encoder.finish()]);
    await this.waitForReadbackMap(context.readbackBuffer.mapAsync(GPUMapMode.READ));
    const readback = new Uint32Array(context.readbackBuffer.getMappedRange().slice(0));
    context.readbackBuffer.unmap();
    return readback;
  }

  /**
   * Waits for readback mapping while treating device loss as a Metrics fallback signal.
   *
   * @private
   * @async
   * @param {Promise<void>} mapPromise readback mapping promise.
   */
  private async waitForReadbackMap(mapPromise: Promise<void>): Promise<void> {
    await Promise.race([
      mapPromise,
      this.device.lost.then(info => {
        this.markDeviceLost(info);
        throw createRecordedGpuMetricsDeviceLostError(info);
      })
    ]);
    this.assertDeviceAvailable();
  }

  /**
   * Marks this backend as unusable after WebGPU device loss.
   *
   * @private
   * @param {GPUDeviceLostInfo} info device loss information.
   */
  private markDeviceLost(info: GPUDeviceLostInfo): void {
    if (!this.deviceLostInfo) {
      this.deviceLostInfo = info;
      if (!this.disposed) {
        console.error('[GOLT] Recorded GPU Metrics device lost; falling back to TypeScript Metrics', info);
      }
    }
  }

  /**
   * Throws when the WebGPU device has been lost.
   *
   * @private
   */
  private assertDeviceAvailable(): void {
    if (this.deviceLostInfo) {
      throw createRecordedGpuMetricsDeviceLostError(this.deviceLostInfo);
    }
  }

  /**
   * Explains fixed GPU limit incompatibilities for one frame.
   *
   * @private
   * @param {PackedRecordedFrame} frame packed recorded frame.
   * @param {(PreviousOfflineMetricFrame | null)} previous previous frame state.
   * @returns {(string | null)} unsupported reason, or null when fixed limits are satisfied.
   */
  private frameLimitReason(frame: PackedRecordedFrame, previous: PreviousOfflineMetricFrame | null): string | null {
    const maxBufferBytes = this.device.limits.maxBufferSize;
    const maxStorageBytes = this.device.limits.maxStorageBufferBindingSize;
    const totalCells = frame.cols * frame.rows;
    const totalContactEdges = totalCells * 2;
    let reason: string | null = null;
    if (frame.words.byteLength > maxBufferBytes) {
      reason = `Recorded GPU Metrics frame buffer (${frame.words.byteLength} bytes) exceeds device buffer limit (${maxBufferBytes} bytes).`;
    } else if (frame.words.byteLength > maxStorageBytes) {
      reason = `Recorded GPU Metrics frame buffer (${frame.words.byteLength} bytes) exceeds device storage buffer binding limit (${maxStorageBytes} bytes).`;
    } else if (previous && previous.words.byteLength > maxBufferBytes) {
      reason = `Recorded GPU Metrics previous frame buffer (${previous.words.byteLength} bytes) exceeds device buffer limit (${maxBufferBytes} bytes).`;
    } else if (previous && previous.words.byteLength > maxStorageBytes) {
      reason = `Recorded GPU Metrics previous frame buffer (${previous.words.byteLength} bytes) exceeds device storage buffer binding limit (${maxStorageBytes} bytes).`;
    } else if (GPU_STATS_BYTE_SIZE > maxBufferBytes) {
      reason = `Recorded GPU Metrics stats buffer (${GPU_STATS_BYTE_SIZE} bytes) exceeds device buffer limit (${maxBufferBytes} bytes).`;
    } else if (GPU_STATS_BYTE_SIZE > maxStorageBytes) {
      reason = `Recorded GPU Metrics stats buffer (${GPU_STATS_BYTE_SIZE} bytes) exceeds device storage buffer binding limit (${maxStorageBytes} bytes).`;
    } else if (GPU_CONFIG_BYTE_SIZE > maxBufferBytes) {
      reason = `Recorded GPU Metrics config buffer (${GPU_CONFIG_BYTE_SIZE} bytes) exceeds device buffer limit (${maxBufferBytes} bytes).`;
    } else if (totalCells > U32_MAX || totalContactEdges > U32_MAX) {
      reason = 'Recorded GPU Metrics counters can overflow for this grid size.';
    }
    return reason;
  }

  /**
   * Releases the reusable GPU context.
   *
   * @private
   */
  private disposeContext(): void {
    if (this.context) {
      this.context.currentBuffer.destroy();
      this.context.previousBuffer.destroy();
      this.context.statsBuffer.destroy();
      this.context.readbackBuffer.destroy();
      this.context.configBuffer.destroy();
      this.context = null;
    }
  }
}

export {RecordedGpuMetricBackend};
