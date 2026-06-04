import {CompressionSchedulerCallbacks, CompressionWaitMode, QueuedCompressionJob} from '../model/compression-scheduler';
import {CompressionFailedMessage} from '../model/download';
import {COMPRESSION_RETRY_DELAY_MS, MAX_COMPRESSION_DEFERRED_REQUEUES, MAX_COMPRESSION_RETRIES, WAITING_COMPRESSION_JOBS_STATUS} from '../model/home-runtime';
import {OPFS_PENDING_COMPRESSION_BYTE_BUDGET} from '../model/recording-limits';
import {ChunkSealedMessage, UncompressedChunksMessage} from '../model/worker-message';

/**
 * Main-thread background compression scheduler.
 *
 * @class CompressionScheduler
 * @typedef {CompressionScheduler}
 */
export class CompressionScheduler {
  /**
   * Compression jobs currently active by filename.
   *
   * @private
   * @readonly
   * @type {Map<string, QueuedCompressionJob>}
   */
  private readonly activeCompressionJobs = new Map<string, QueuedCompressionJob>();

  /**
   * Promise resolvers waiting for compression queue changes.
   *
   * @private
   * @readonly
   * @type {Set<() => void>}
   */
  private readonly compressionDrainResolvers = new Set<() => void>();

  /**
   * Background compression worker pool.
   *
   * @private
   * @type {Worker[]}
   */
  private compressPool: Worker[] = [];

  /**
   * Round-robin compression worker index.
   *
   * @private
   * @type {number}
   */
  private compressPoolIndex = 0;

  /**
   * Compression jobs waiting for dispatch.
   *
   * @private
   * @type {QueuedCompressionJob[]}
   */
  private pendingCompressionJobs: QueuedCompressionJob[] = [];

  /**
   * Compression jobs deferred after retry exhaustion.
   *
   * @private
   * @type {QueuedCompressionJob[]}
   */
  private deferredCompressionJobs: QueuedCompressionJob[] = [];

  /**
   * Pending compression retry timers.
   *
   * @private
   * @type {number[]}
   */
  private compressionRetryTimers: number[] = [];

  /**
   * Raw bytes currently active in compression workers.
   *
   * @private
   * @type {number}
   */
  private activeCompressionBytes = 0;

  /**
   * Whether compression dispatch is paused for download preparation.
   *
   * @private
   * @type {boolean}
   */
  private compressionDispatchPaused = false;

  /**
   * @constructor
   * @public
   * @param {CompressionSchedulerCallbacks} callbacks scheduler callbacks.
   */
  public constructor(private readonly callbacks: CompressionSchedulerCallbacks) {}

  /**
   * Queues one sealed recording chunk for background compression.
   *
   * @public
   * @param {ChunkSealedMessage} chunk sealed chunk message.
   */
  public enqueueChunk(chunk: ChunkSealedMessage): void {
    this.ensurePool();
    this.pendingCompressionJobs.push({
      chunk,
      attempts: 0,
      deferredRequeues: 0
    });
    this.dispatchCompressionJobs();
    this.notifyCompressionDrainWaiters();
    this.callbacks.refreshDownloadEstimate();
  }

  /**
   * Requeues engine-reported chunks that are still uncompressed.
   *
   * @public
   * @param {UncompressedChunksMessage} data uncompressed chunks message.
   */
  public enqueueUncompressedChunks(data: UncompressedChunksMessage): void {
    for (const chunk of data.chunks) {
      this.enqueueChunk({type: 'chunkSealed', ...chunk});
    }
  }

  /**
   * Ensures workers are available when recording is enabled.
   *
   * @public
   */
  public ensurePool(): void {
    if (this.compressPool.length === 0) {
      this.initPool();
    }
  }

  /**
   * Terminates compression workers and clears pending compression state.
   *
   * @public
   */
  public terminate(): void {
    for (const worker of this.compressPool) {
      worker.terminate();
    }
    for (const timer of this.compressionRetryTimers) {
      clearTimeout(timer);
    }
    this.compressPool = [];
    this.compressPoolIndex = 0;
    this.pendingCompressionJobs = [];
    this.deferredCompressionJobs = [];
    this.activeCompressionJobs.clear();
    this.compressionRetryTimers = [];
    this.activeCompressionBytes = 0;
    this.compressionDispatchPaused = false;
    this.notifyCompressionDrainWaiters();
  }

  /**
   * Requeues deferred failed compression jobs after memory pressure drops.
   *
   * @public
   */
  public requeueDeferredJobs(): void {
    if (this.deferredCompressionJobs.length > 0) {
      const jobs = this.deferredCompressionJobs.map(job => ({
        ...job,
        attempts: 0,
        deferredRequeues: job.deferredRequeues + 1
      }));
      this.deferredCompressionJobs = [];
      this.pendingCompressionJobs.push(...jobs);
      console.log('[GOLT] Requeued deferred compression jobs', {count: jobs.length});
      this.dispatchCompressionJobs();
      this.notifyCompressionDrainWaiters();
      this.callbacks.refreshDownloadEstimate();
    }
  }

  /**
   * Waits for compression jobs before download handoff.
   *
   * @public
   * @async
   * @param {CompressionWaitMode} mode compression wait mode.
   */
  public async waitForDownloadCompression(mode: CompressionWaitMode): Promise<void> {
    if (mode === 'all') {
      this.requeueDeferredJobs();
    } else {
      this.compressionDispatchPaused = true;
    }
    const initialJobs = Math.max(0, this.countCompressionWaitJobs(mode));
    this.updateCompressionWaitProgress(WAITING_COMPRESSION_JOBS_STATUS, 0, initialJobs);
    while (!this.callbacks.isDownloadCancelled() && this.countCompressionWaitJobs(mode) > 0) {
      const remainingJobs = this.countCompressionWaitJobs(mode);
      const completedJobs = Math.max(0, initialJobs - remainingJobs);
      this.updateCompressionWaitProgress(WAITING_COMPRESSION_JOBS_STATUS, completedJobs, initialJobs);
      await new Promise<void>(resolve => {
        this.compressionDrainResolvers.add(resolve);
      });
    }
    this.updateCompressionWaitProgress(WAITING_COMPRESSION_JOBS_STATUS, initialJobs, initialJobs);
  }

  /**
   * Notifies waiters that compression queue state changed.
   *
   * @public
   */
  public notifyWaiters(): void {
    this.notifyCompressionDrainWaiters();
  }

  /**
   * Resumes compression dispatch after a download wait.
   *
   * @public
   */
  public resume(): void {
    this.compressionDispatchPaused = false;
    for (const worker of this.compressPool) {
      worker.postMessage({type: 'resumeCompression'});
    }
    this.dispatchCompressionJobs();
  }

  /**
   * Creates the background compression worker pool.
   *
   * @private
   */
  private initPool(): void {
    const poolSize = Math.max(1, (navigator.hardwareConcurrency ?? 4) - 2);
    for (let i = 0; i < poolSize; i++) {
      const worker = new Worker(new URL('../worker/compress.ts', import.meta.url), {type: 'module'});
      worker.onmessage = (ev: MessageEvent) => {
        if (ev.data?.type === 'compressed') {
          this.callbacks.updateChunkCodec(ev.data);
          this.completeCompressionJob(ev.data.filename, ev.data.rawBytes);
        } else if (ev.data?.type === 'compressionFailed') {
          const failed = ev.data as CompressionFailedMessage;
          this.failCompressionJob(failed.filename, failed.rawBytes);
        }
      };
      this.compressPool.push(worker);
    }
  }

  /**
   * Dispatches queued compression jobs within the memory budget.
   *
   * @private
   */
  private dispatchCompressionJobs(): void {
    let dispatched = true;
    while (!this.compressionDispatchPaused && dispatched && this.pendingCompressionJobs.length > 0 && this.compressPool.length > 0) {
      const nextJob = this.pendingCompressionJobs[0]!;
      if (this.canDispatchCompressionJob(nextJob)) {
        this.pendingCompressionJobs.shift();
        this.postCompressionJob(nextJob);
      } else {
        dispatched = false;
      }
    }
  }

  /**
   * Checks whether one compression job fits the active memory budget.
   *
   * @private
   * @param {QueuedCompressionJob} job compression job.
   * @returns {boolean} true when the job can start now.
   */
  private canDispatchCompressionJob(job: QueuedCompressionJob): boolean {
    return this.activeCompressionBytes === 0 || this.activeCompressionBytes + job.chunk.rawBytes <= OPFS_PENDING_COMPRESSION_BYTE_BUDGET;
  }

  /**
   * Sends one compression job to the worker pool.
   *
   * @private
   * @param {QueuedCompressionJob} job compression job.
   */
  private postCompressionJob(job: QueuedCompressionJob): void {
    const worker = this.compressPool[this.compressPoolIndex % this.compressPool.length]!;
    this.compressPoolIndex++;
    this.activeCompressionBytes += job.chunk.rawBytes;
    this.activeCompressionJobs.set(job.chunk.filename, job);
    worker.postMessage({
      type: 'compress',
      filename: job.chunk.filename,
      rawBytes: job.chunk.rawBytes,
      blockCount: job.chunk.blockCount,
      cols: job.chunk.cols,
      rows: job.chunk.rows,
      rawGridFormat: job.chunk.rawGridFormat,
      storageGridFormat: job.chunk.storageGridFormat
    });
  }

  /**
   * Releases active compression memory after a worker finishes a job.
   *
   * @private
   * @param {string} filename completed chunk filename.
   * @param {number} rawBytes raw bytes for the completed job.
   */
  private completeCompressionJob(filename: string, rawBytes: number): void {
    const activeJob = this.activeCompressionJobs.get(filename);
    const completedBytes = activeJob?.chunk.rawBytes ?? rawBytes;
    this.activeCompressionJobs.delete(filename);
    this.activeCompressionBytes = Math.max(0, this.activeCompressionBytes - completedBytes);
    this.dispatchCompressionJobs();
    this.notifyCompressionDrainWaiters();
    this.callbacks.refreshDownloadEstimate();
  }

  /**
   * Handles a compression job failure.
   *
   * @private
   * @param {string} filename failed chunk filename.
   * @param {number} rawBytes failed chunk raw bytes.
   */
  private failCompressionJob(filename: string, rawBytes: number): void {
    const failedJob = this.activeCompressionJobs.get(filename);
    this.completeCompressionJob(filename, rawBytes);
    if (failedJob) {
      this.scheduleCompressionRetryOrDefer(failedJob);
    }
  }

  /**
   * Schedules a delayed retry or defers a repeatedly failed compression job.
   *
   * @private
   * @param {QueuedCompressionJob} job failed compression job.
   */
  private scheduleCompressionRetryOrDefer(job: QueuedCompressionJob): void {
    if (job.attempts < MAX_COMPRESSION_RETRIES) {
      this.scheduleCompressionRetry({...job, attempts: job.attempts + 1});
    } else if (job.deferredRequeues < MAX_COMPRESSION_DEFERRED_REQUEUES) {
      console.warn('[GOLT] Compression job deferred after retries:', job.chunk.filename);
      this.deferredCompressionJobs.push({...job, attempts: 0});
      this.callbacks.refreshDownloadEstimate();
    } else {
      console.warn('[GOLT] Compression job left raw after repeated retry cycles:', job.chunk.filename);
      this.callbacks.refreshDownloadEstimate();
    }
  }

  /**
   * Adds a compression job back to the queue after exponential backoff.
   *
   * @private
   * @param {QueuedCompressionJob} job retry job.
   */
  private scheduleCompressionRetry(job: QueuedCompressionJob): void {
    const delayMs = COMPRESSION_RETRY_DELAY_MS * 2 ** (job.attempts - 1);
    const timer = setTimeout(() => {
      this.compressionRetryTimers = this.compressionRetryTimers.filter(t => t !== timer);
      this.pendingCompressionJobs.push(job);
      this.dispatchCompressionJobs();
      this.notifyCompressionDrainWaiters();
    }, delayMs);
    this.compressionRetryTimers.push(timer);
    this.notifyCompressionDrainWaiters();
  }

  /**
   * Counts queued, active, retrying, and deferred compression jobs.
   *
   * @private
   * @param {CompressionWaitMode} mode count mode.
   * @returns {number} compression job count.
   */
  private countCompressionWaitJobs(mode: CompressionWaitMode): number {
    let jobs: number;
    if (mode === 'active') {
      jobs = this.activeCompressionJobs.size;
    } else {
      jobs = this.activeCompressionJobs.size + this.pendingCompressionJobs.length + this.compressionRetryTimers.length + this.deferredCompressionJobs.length;
    }
    return jobs;
  }

  /**
   * Updates compression wait progress.
   *
   * @private
   * @param {string} label status label.
   * @param {number} completedJobs completed jobs.
   * @param {number} totalJobs total jobs.
   */
  private updateCompressionWaitProgress(label: string, completedJobs: number, totalJobs: number): void {
    this.callbacks.setDownloadProgress(Math.max(this.callbacks.getDownloadProgress(), Math.round(30 * (totalJobs > 0 ? completedJobs / totalJobs : 1))), this.formatCompressionWaitStatus(label, completedJobs, totalJobs));
    this.callbacks.markForCheck();
  }

  /**
   * Formats compression wait progress status.
   *
   * @private
   * @param {string} label status label.
   * @param {number} completedJobs completed job count.
   * @param {number} totalJobs total job count.
   * @returns {string} formatted status.
   */
  private formatCompressionWaitStatus(label: string, completedJobs: number, totalJobs: number): string {
    return `${label} (${Math.max(0, completedJobs)} / ${Math.max(0, totalJobs)})`;
  }

  /**
   * Notifies waiters that compression queue state changed.
   *
   * @private
   */
  private notifyCompressionDrainWaiters(): void {
    for (const resolve of Array.from(this.compressionDrainResolvers)) {
      this.compressionDrainResolvers.delete(resolve);
      resolve();
    }
  }
}
