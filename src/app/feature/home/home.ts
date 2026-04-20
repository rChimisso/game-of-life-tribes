import {ChangeDetectorRef, Component, HostListener, OnDestroy, ViewChild} from '@angular/core';
import {MatIconModule} from '@angular/material/icon';
import {MatProgressBarModule} from '@angular/material/progress-bar';
import {MatSnackBar, MatSnackBarModule} from '@angular/material/snack-bar';
import {RouterModule} from '@angular/router';

import {Engine} from './component/engine/engine';
import {Sidebar, SidebarEvent} from './component/sidebar/sidebar';
import {Preset} from './model/preset';
import {DEAD_TRIBE, Ruleset, Tribe} from './model/rule';
import {MetricMessage, GenerationMessage, LimitsMessage, RecordingMessage, RebuildingMessage, DeviceLostMessage, GpuErrorMessage, SnapshotMessage, SteppingMessage, ChunksSavingMessage, ChunkSealedMessage, BackpressureMessage, StorageQuotaMessage, UncompressedChunksMessage, BrushShape} from './worker/webengine';

@Component({
  selector: 'gol-home',
  standalone: true,
  imports: [
    RouterModule,
    Engine,
    Sidebar,
    MatIconModule,
    MatProgressBarModule,
    MatSnackBarModule
  ],
  templateUrl: './home.html',
  styleUrl: './home.scss'
})
export class HomePage implements OnDestroy {
  @ViewChild(Engine) engine!: Engine<Tribe[]>;

  ruleset: Ruleset = {
    cols: 100,
    rows: 100,
    tribes: [
      DEAD_TRIBE,
      {id: 'classic',
        color: 'f0f0f0'},
      {id: 'red',
        color: 'ff0000'},
      {id: 'blue',
        color: '0000ff'},
      {id: 'green',
        color: '00ff00'}
    ],
    rules: [
      {
        clause: {
          kind: 'and',
          clauses: [
            {kind: 'is',
              tribes: ['classic']},
            {
              kind: 'count',
              interval: [0, 1],
              tribes: ['classic']
            }
          ]
        },
        tribe: DEAD_TRIBE.id
      },
      {
        clause: {
          kind: 'and',
          clauses: [
            {kind: 'is',
              tribes: ['classic']},
            {
              kind: 'count',
              interval: [2, 3],
              tribes: ['classic']
            }
          ]
        },
        tribe: 'classic'
      },
      {
        clause: {
          kind: 'and',
          clauses: [
            {kind: 'is',
              tribes: ['classic']},
            {
              kind: 'count',
              interval: [4, 8],
              tribes: ['classic']
            }
          ]
        },
        tribe: DEAD_TRIBE.id
      },
      {
        clause: {
          kind: 'and',
          clauses: [
            {kind: 'is',
              tribes: ['dead']},
            {
              kind: 'count',
              interval: [3, 3],
              tribes: ['classic']
            }
          ]
        },
        tribe: 'classic'
      }
    ]
  };

  state: 'running' | 'paused' = 'paused';

  speed = 1;

  maxSpeed = false;

  recording = false;

  drawTribes: string[] = ['classic'];

  deleteMode = false;

  panMode = false;

  latestMetrics: MetricMessage | null = null;

  brushSize = 1;

  brushShape: BrushShape = 'square';

  brushFill: 'full' | 'spray' | 'outline' = 'full';

  skipAmount = 1;

  downloadProgress = -1;

  downloadSubProgress = -1;

  downloadStatus = '';

  downloadMainStatus = '';

  maxBytes = Infinity;

  vramBudgetBytes = Infinity;

  frameByteSize = 0;

  vramSimulationBytes = 0;

  vramRecordingBytes = 0;

  recordingAvailable = true;

  stepping = false;

  chunksSaving = false;

  backpressure = false;

  rebuilding = false;

  gpuErrorMessage: string | null = null;

  storageUsedBytes = 0;

  storageQuotaBytes = 0;

  storagePendingRawBytes = 0;

  storageCompressedBytes = 0;

  savingState = false;

  loadingState = false;

  private quotaWarningLevel: 0 | 25 | 50 | 75 | 100 = 0;

  private pendingStateLoad: {grid: Uint32Array; generation: number} | null = null;

  private compressPool: Worker[] = [];

  private compressPoolIndex = 0;

  private downloadWorker: Worker | null = null;

  private drawTribeIndex = 1;

  public get tribes(): readonly Tribe[] {
    return this.ruleset.tribes;
  }

  public get effectiveSpeed(): number {
    return this.maxSpeed ? -1 : this.speed;
  }

  private static readonly PREFS_KEY = 'golt-sim-prefs';

  public constructor(private readonly cdr: ChangeDetectorRef, private readonly snackBar: MatSnackBar) {
    this.loadPrefs();
    document.addEventListener('keydown', this.boundKeydown, true);
  }

  @HostListener('mousedown', ['$event'])
  public onHostMousedown(ev: MouseEvent): void {
    const target = ev.target as HTMLElement;
    if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement) {
      return;
    }
    // Defer blur so it fires after the browser sets focus on the clicked element.
    setTimeout(() => (document.activeElement as HTMLElement)?.blur?.());
  }

  public ngOnDestroy(): void {
    document.removeEventListener('keydown', this.boundKeydown, true);
    this.terminateCompressWorker();
  }

  private handleKeydown(ev: KeyboardEvent): void {
    if (this.downloadProgress >= 0) {
      return;
    }
    // While stepping, only allow spacebar (to cancel the step).
    if (this.stepping) {
      if (ev.key === ' ') {
        this.cancelStepping();
        ev.preventDefault();
        ev.stopPropagation();
        (document.activeElement as HTMLElement)?.blur?.();
        this.cdr.markForCheck();
      }
      return;
    }
    const active = document.activeElement;
    if (active instanceof HTMLTextAreaElement || active instanceof HTMLSelectElement) {
      return;
    }
    if (active instanceof HTMLInputElement) {
      const t = active.type;
      if (t !== 'checkbox' && t !== 'radio') {
        return;
      }
    }
    let handled = true;
    switch (ev.key) {
      case ' ':
        this.toggleRun();
        break;
      case 'ArrowUp':
        this.speed += 1;
        this.maxSpeed = false;
        break;
      case 'ArrowDown':
        this.speed = Math.max(1, this.speed - 1);
        break;
      case 'ArrowRight':
        this.drawTribeIndex = (this.drawTribeIndex + 1) % this.tribes.length;
        if (this.drawTribeIndex === 0) {
          this.drawTribeIndex = 1;
        }
        this.drawTribes = [this.tribes[this.drawTribeIndex]!.id];
        this.deleteMode = false;
        break;
      case 'ArrowLeft':
        this.drawTribeIndex -= 1;
        if (this.drawTribeIndex <= 0) {
          this.drawTribeIndex = this.tribes.length - 1;
        }
        this.drawTribes = [this.tribes[this.drawTribeIndex]!.id];
        this.deleteMode = false;
        break;
      case 'r':
        this.restart();
        break;
      case 'd':
        this.deleteMode = !this.deleteMode;
        if (this.deleteMode) {
          this.drawTribes = [DEAD_TRIBE.id];
        } else {
          this.drawTribes = [this.tribes[this.drawTribeIndex]!.id];
        }
        break;
      case 'e':
        if (this.recordingAvailable) {
          this.recording = !this.recording;
        }
        break;
      case 'm':
        this.maxSpeed = !this.maxSpeed;
        break;
      case '+':
      case '=': {
        const max = Math.max(1, Math.floor(Math.max(this.ruleset.cols, this.ruleset.rows) / 4));
        this.brushSize = Math.min(max, this.brushSize + 1);
        break;
      }
      case '-': {
        this.brushSize = Math.max(1, this.brushSize - 1);
        break;
      }
      case 'b': {
        const shapes: BrushShape[] = [
          'square',
          'round',
          'diamond',
          'vline',
          'hline'
        ];
        const idx = shapes.indexOf(this.brushShape);
        this.brushShape = shapes[(idx + 1) % shapes.length]!;
        break;
      }
      case 'f': {
        const fills: ('full' | 'spray' | 'outline')[] = ['full', 'spray', 'outline'];
        const idx = fills.indexOf(this.brushFill);
        this.brushFill = fills[(idx + 1) % fills.length]!;
        break;
      }
      default:
        handled = false;
    }
    if (handled) {
      ev.preventDefault();
      ev.stopPropagation();
      (document.activeElement as HTMLElement)?.blur?.();
      this.savePrefs();
      this.cdr.markForCheck();
    }
  }

  onMetrics(data: MetricMessage): void {
    this.latestMetrics = data;
    this.cdr.markForCheck();
  }

  onGeneration(data: GenerationMessage): void {
    if (this.latestMetrics) {
      this.latestMetrics = {
        ...this.latestMetrics,
        generation: data.generation,
        fps: data.fps
      };
    } else {
      this.latestMetrics = {
        type: 'metrics',
        generation: data.generation,
        population: {},
        shannonEntropy: 0,
        simpsonIndex: 0,
        boundaryLength: 0,
        extinctionTime: {},
        totalFrames: 0,
        fps: data.fps,
        canStepBack: false,
        recordingBytes: 0,
        recordingRawBytes: 0
      };
    }
    this.cdr.markForCheck();
  }

  onLimits(data: LimitsMessage): void {
    this.maxBytes = data.maxBytes;
    this.vramBudgetBytes = data.vramBudgetBytes;
    this.frameByteSize = data.frameByteSize;
    this.vramSimulationBytes = data.vramSimulationBytes;
    this.vramRecordingBytes = data.vramRecordingBytes;
    this.recordingAvailable = data.recordingAvailable;
    if (!data.recordingAvailable && this.recording) {
      this.recording = false;
    }
    this.cdr.markForCheck();
  }

  onStepping(data: SteppingMessage): void {
    this.stepping = data.active;
    this.cdr.markForCheck();
  }

  onChunksSaving(data: ChunksSavingMessage): void {
    this.chunksSaving = data.active;
    this.cdr.markForCheck();
  }

  onBackpressure(data: BackpressureMessage): void {
    this.backpressure = data.active;
    this.cdr.markForCheck();
  }

  onRebuilding(data: RebuildingMessage): void {
    this.rebuilding = data.active;
    if (!data.active) {
      this.gpuErrorMessage = null;
      if (this.pendingStateLoad) {
        const {grid, generation} = this.pendingStateLoad;
        this.pendingStateLoad = null;
        this.engine.loadSnapshot(grid, generation);
        this.latestMetrics = null;
      }
    }
    this.cdr.markForCheck();
  }

  onDeviceLost(data: DeviceLostMessage): void {
    this.state = 'paused';
    this.gpuErrorMessage = `GPU device lost: ${data.reason}`;
    this.snackBar.open('GPU device lost — simulation stopped. Try reloading the page.', 'Dismiss', {duration: 10_000});
    this.cdr.markForCheck();
  }

  onGpuError(data: GpuErrorMessage): void {
    this.gpuErrorMessage = data.reason;
    this.snackBar.open(`GPU error: ${data.reason}`, 'Dismiss', {duration: 8_000});
    this.cdr.markForCheck();
  }

  onStorageQuota(data: StorageQuotaMessage): void {
    this.storageUsedBytes = data.usedBytes;
    this.storageQuotaBytes = data.quotaBytes;
    this.storagePendingRawBytes = data.pendingRawBytes;
    this.storageCompressedBytes = data.compressedBytes;
    if (data.quotaBytes <= 0) {
      return;
    }
    // Mixed byte formats: used in decimal GB, quota in binary GiB.
    // Include GPU buffer margin (worst-case data in flight not yet on disk).
    const effectiveUsed = data.usedBytes + data.gpuBufferMarginBytes;
    const usedDecimalGiga = effectiveUsed / 1e9;
    const quotaBinaryGiga = data.quotaBytes / (1024 ** 3);
    const pct = quotaBinaryGiga > 0 ? (usedDecimalGiga / quotaBinaryGiga) * 100 : 0;
    const level: 0 | 25 | 50 | 75 | 100 = pct >= 100 ? 100 : pct >= 75 ? 75 : pct >= 50 ? 50 : pct >= 25 ? 25 : 0;
    if (level > this.quotaWarningLevel) {
      this.quotaWarningLevel = level;
      const compHint = this.storagePendingRawBytes > 0 ? ' (compression in progress — size may decrease)' : '';
      const alreadyPaused = this.state === 'paused' && !this.stepping;
      if (level === 25) {
        this.snackBar.open(`Recording storage at 25% capacity${compHint}`, 'Dismiss', {duration: 0,
          panelClass: 'snackbar-info'});
      } else if (level === 50) {
        this.snackBar.open(`Recording storage at 50% capacity${compHint}`, 'Dismiss', {duration: 0,
          panelClass: 'snackbar-warning'});
      } else if (level === 75) {
        const pauseHint = alreadyPaused ? '' : ' — simulation paused to preserve data';
        this.snackBar.open(`Recording storage at 75%${pauseHint}${compHint}`, 'Dismiss', {duration: 0,
          panelClass: 'snackbar-warning'});
        if (this.stepping) {
          this.cancelStepping();
        }
        this.state = 'paused';
      } else if (level === 100) {
        this.snackBar.open(`Storage full — recording disabled. Save your data, then reset.${compHint}`, 'Dismiss', {duration: 0,
          panelClass: 'snackbar-error'});
        if (this.stepping) {
          this.cancelStepping();
        }
        this.state = 'paused';
        this.recording = false;
      }
    } else if (level < this.quotaWarningLevel) {
      this.quotaWarningLevel = level;
      this.snackBar.dismiss();
    }
    this.cdr.markForCheck();
  }

  onChunkSealed(data: ChunkSealedMessage): void {
    if (this.compressPool.length === 0) {
      this.initCompressPool();
    }
    const worker = this.compressPool[this.compressPoolIndex % this.compressPool.length]!;
    this.compressPoolIndex++;
    worker.postMessage({
      type: 'compress',
      filename: data.filename,
      rawBytes: data.rawBytes
    });
  }

  onUncompressedChunks(data: UncompressedChunksMessage): void {
    for (const chunk of data.chunks) {
      this.onChunkSealed({
        type: 'chunkSealed',
        filename: chunk.filename,
        rawBytes: chunk.rawBytes
      });
    }
  }

  onSnapshot(snap: SnapshotMessage): void {
    if (this.pendingSnapshotResolve) {
      this.pendingSnapshotResolve(snap);
      this.pendingSnapshotResolve = null;
    } else {
      this.saveGoltState(snap).finally(() => {
        this.savingState = false;
        this.cdr.markForCheck();
      });
    }
  }

  onRecording(rec: RecordingMessage): void {
    if (this.pendingRecordingResolve) {
      this.pendingRecordingResolve(rec);
      this.pendingRecordingResolve = null;
    } else {
      this.pendingRecording = rec;
    }
  }

  private pendingRecording: RecordingMessage | null = null;

  private pendingSnapshotResolve: ((snap: SnapshotMessage) => void) | null = null;

  private pendingRecordingResolve: ((rec: RecordingMessage) => void) | null = null;

  onSidebarEvent(ev: SidebarEvent): void {
    switch (ev.action) {
      case 'toggleRun':
        this.toggleRun();
        break;
      case 'restart':
        this.restart();
        break;
      case 'selectTribe':
        this.deleteMode = false;
        this.drawTribes = [ev.value as string];
        this.drawTribeIndex = this.tribes.findIndex(t => t.id === (ev.value as string));
        break;
      case 'selectTribes':
        this.drawTribes = ev.value as string[];
        this.deleteMode = this.drawTribes.length === 1 && this.drawTribes[0] === DEAD_TRIBE.id;
        if (!this.deleteMode && this.drawTribes.length === 1) {
          this.drawTribeIndex = this.tribes.findIndex(t => t.id === this.drawTribes[0]);
        }
        break;
      case 'setSpeed':
        this.speed = ev.value as number;
        this.maxSpeed = false;
        this.savePrefs();
        break;
      case 'setMaxSpeed':
        this.maxSpeed = ev.value as boolean;
        break;
      case 'setRecording':
        this.recording = ev.value as boolean;
        this.savePrefs();
        if (this.recording && this.compressPool.length === 0) {
          this.initCompressPool();
        }
        break;
      case 'setGridSize': {
        const {cols, rows} = ev.value as {cols: number; rows: number};
        this.rebuilding = true;
        this.ruleset = {
          ...this.ruleset,
          cols,
          rows
        };
        this.latestMetrics = null;
        this.clampBrushSize();
        break;
      }
      case 'download':
        this.downloadZip(ev.value as {csv: boolean; mp4: boolean; png: boolean; saves: boolean; fps: number; bitrate: number});
        break;
      case 'cancelDownload':
        this.cancelDownload();
        break;
      case 'saveState':
        this.savingState = true;
        this.cdr.markForCheck();
        this.engine.requestSnapshot();
        break;
      case 'loadState':
        this.loadState(ev.value as ArrayBuffer);
        break;
      case 'deleteMode':
        this.deleteMode = !this.deleteMode;
        if (this.deleteMode) {
          this.drawTribes = [DEAD_TRIBE.id];
        } else {
          this.drawTribes = [this.tribes[this.drawTribeIndex]!.id];
        }
        break;
      case 'updateRuleset': {
        const newRuleset = ev.value as Ruleset;
        this.rebuilding = true;
        this.ruleset = newRuleset;
        if (!newRuleset.tribes.some(t => this.drawTribes.includes(t.id))) {
          this.drawTribes = [newRuleset.tribes.find(t => t.id !== 'dead')?.id ?? 'dead'];
        }
        this.drawTribeIndex = newRuleset.tribes.findIndex(t => t.id === this.drawTribes[0]);
        this.latestMetrics = null;
        this.clampBrushSize();
        break;
      }
      case 'stepBack':
        this.engine.stepBack(ev.value as number);
        break;
      case 'stepForward':
        this.engine.stepForward(ev.value as number);
        break;
      case 'togglePanMode':
        this.panMode = !this.panMode;
        break;
      case 'setBrushSize':
        this.brushSize = ev.value as number;
        break;
      case 'setBrushShape':
        this.brushShape = ev.value as BrushShape;
        this.savePrefs();
        break;
      case 'setBrushFill':
        this.brushFill = ev.value as 'full' | 'spray' | 'outline';
        this.savePrefs();
        break;
      case 'applyPreset': {
        const preset = ev.value as Preset;
        const newRuleset = structuredClone(preset.ruleset);
        newRuleset.cols = this.ruleset.cols;
        newRuleset.rows = this.ruleset.rows;
        this.rebuilding = true;
        this.ruleset = newRuleset;
        if (!newRuleset.tribes.some(t => this.drawTribes.includes(t.id))) {
          this.drawTribes = [newRuleset.tribes.find(t => t.id !== 'dead')?.id ?? 'dead'];
        }
        this.drawTribeIndex = newRuleset.tribes.findIndex(t => t.id === this.drawTribes[0]);
        this.latestMetrics = null;
        this.clampBrushSize();
        break;
      }
    }
  }

  private toggleRun(): void {
    if (this.stepping) {
      this.cancelStepping();
      return;
    }
    this.state = this.state === 'paused' ? 'running' : 'paused';
  }

  private cancelStepping(): void {
    this.engine.cancelStepping();
  }

  private terminateCompressWorker(): void {
    for (const w of this.compressPool) {
      w.terminate();
    }
    this.compressPool = [];
    this.compressPoolIndex = 0;
  }

  private initCompressPool(): void {
    const poolSize = Math.max(1, (navigator.hardwareConcurrency ?? 4) - 2);
    for (let i = 0; i < poolSize; i++) {
      const w = new Worker(new URL('./worker/compress.ts', import.meta.url), {type: 'module'});
      w.onmessage = (ev: MessageEvent) => {
        if (ev.data?.type === 'compressed') {
          this.engine.updateChunkCodec(ev.data.filename, ev.data.codec, ev.data.storedBytes);
        }
      };
      this.compressPool.push(w);
    }
  }

  private cancelDownload(): void {
    if (this.downloadWorker) {
      this.downloadWorker.terminate();
      this.downloadWorker = null;
    }
    this.downloadProgress = -1;
    this.downloadSubProgress = -1;
    this.downloadStatus = '';
    this.downloadMainStatus = '';
    this.cdr.markForCheck();

    // Resume background compression for any remaining raw-packed chunks.
    this.engine.requestUncompressedChunks();
  }

  private restart(): void {
    this.snackBar.dismiss();
    this.state = 'paused';
    this.terminateCompressWorker();
    this.storagePendingRawBytes = 0;
    this.storageCompressedBytes = 0;
    this.storageUsedBytes = 0;
    this.quotaWarningLevel = 0;
    this.rebuilding = true;
    this.ruleset = {...this.ruleset};
    this.latestMetrics = null;
  }

  private clampBrushSize(): void {
    const max = Math.max(1, Math.floor(Math.min(this.ruleset.cols, this.ruleset.rows) / 4));
    if (this.brushSize > max) {
      this.brushSize = max;
    }
  }

  private downloadZip(opts: {csv: boolean; mp4: boolean; png: boolean; saves: boolean; fps: number; bitrate: number}): void {
    const needFrames = opts.mp4 || opts.png || opts.csv || opts.saves;

    // Pause the simulation so the download captures a consistent state.
    if (this.state === 'running') {
      this.state = 'paused';
    }

    // Terminate background compression to prevent file rewrites during download.
    // The download worker handles both raw and compressed codecs.
    this.terminateCompressWorker();

    this.downloadProgress = 0;
    this.cdr.markForCheck();

    const snapshotP = new Promise<SnapshotMessage>(resolve => {
      this.pendingSnapshotResolve = resolve;
      this.engine.requestSnapshot();
    });

    const framesP = needFrames ?
      new Promise<RecordingMessage>(resolve => {
        this.pendingRecordingResolve = resolve;
        this.engine.requestRecording();
      }) :
      Promise.resolve(null);

    Promise.all([snapshotP, framesP]).then(([snap, rec]) => {
      const worker = new Worker(new URL('./worker/download.ts', import.meta.url), {type: 'module'});
      this.downloadWorker = worker;

      const cleanupDownload = () => {
        this.downloadProgress = -1;
        this.downloadSubProgress = -1;
        this.downloadStatus = '';
        this.downloadMainStatus = '';
        this.downloadWorker = null;
        this.cdr.markForCheck();
        worker.terminate();
        this.engine.requestUncompressedChunks();
      };

      worker.onerror = () => {
        this.snackBar.open('Download failed unexpectedly. Try again.', 'Dismiss', {duration: 8_000});
        cleanupDownload();
      };

      worker.onmessage = (e: MessageEvent) => {
        if (e.data.type === 'progress') {
          this.downloadProgress = e.data.percent;
          this.downloadMainStatus = e.data.status ?? '';
          this.cdr.markForCheck();
        } else if (e.data.type === 'sub-progress') {
          this.downloadSubProgress = e.data.percent;
          this.downloadStatus = e.data.status ?? '';
          this.cdr.markForCheck();
        } else if (e.data.type === 'done-part') {
          this.downloadBlob(new Blob([e.data.buffer]), e.data.filename);
        } else if (e.data.type === 'error') {
          this.snackBar.open(`Download error: ${e.data.reason}`, 'Dismiss', {duration: 8_000});
          cleanupDownload();
        } else if (e.data.type === 'done') {
          cleanupDownload();
        }
      };
      const gridBuf = snap.grid;
      const hasChunks = rec && rec.manifest.chunks.length > 0;
      const transferables: ArrayBuffer[] = [];
      if (gridBuf?.buffer?.byteLength > 0) {
        transferables.push(gridBuf.buffer);
      }
      worker.postMessage({
        type: 'download',
        opts,
        snapshot: {
          generation: snap.generation,
          cols: snap.cols,
          rows: snap.rows,
          grid: gridBuf
        },
        recording: hasChunks ? {
          manifest: rec.manifest,
          cols: rec.cols,
          rows: rec.rows
        } : null,
        tribes: this.tribes.map(t => ({id: t.id,
          color: t.color})),
        rules: this.ruleset.rules,
        metricsHistory: []
      }, transferables);
    });
  }

  private async loadState(buffer: ArrayBuffer): Promise<void> {
    this.loadingState = true;
    this.cdr.markForCheck();
    try {
      const parsed = await this.parseGoltFile(buffer) ?? this.parseLegacyJsonState(buffer);
      if (!parsed) {
        return;
      }
      const {cols, rows, generation, grid} = parsed;
      if (cols !== this.ruleset.cols || rows !== this.ruleset.rows) {
        this.rebuilding = true;
        this.pendingStateLoad = {grid,
          generation};
        this.ruleset = {
          ...this.ruleset,
          cols,
          rows
        };
        this.clampBrushSize();
      } else {
        this.engine.loadSnapshot(grid, generation);
        this.latestMetrics = null;
      }
    } finally {
      this.loadingState = false;
      this.cdr.markForCheck();
    }
  }

  private async saveGoltState(snap: SnapshotMessage): Promise<void> {
    const blob = await this.buildGoltFile(snap);
    this.downloadBlob(blob, `gol-state-gen${snap.generation}.golt`);
  }

  private async buildGoltFile(snap: SnapshotMessage): Promise<Blob> {
    const MAGIC = new Uint8Array([
      0x47,
      0x6F,
      0x4C,
      0x54
    ]); // "GoLT"
    const header = JSON.stringify({
      generation: snap.generation,
      cols: snap.cols,
      rows: snap.rows,
      tribes: this.tribes.map(t => ({id: t.id,
        color: t.color})),
      rules: this.ruleset.rules
    });
    const headerBytes = new TextEncoder().encode(header);
    const gridBytes = new Uint8Array(snap.grid.buffer, snap.grid.byteOffset, snap.grid.byteLength);

    // Compress grid with deflate-raw
    const cs = new CompressionStream('deflate-raw');
    const writer = cs.writable.getWriter();
    writer.write(gridBytes);
    writer.close();
    const compressedGrid = await new Response(cs.readable).arrayBuffer();

    // Build: magic(4) + version(4) + headerLen(4) + header + compressed grid
    const preambleSize = 4 + 4 + 4 + headerBytes.byteLength;
    const preamble = new ArrayBuffer(preambleSize);
    const view = new DataView(preamble);
    const bytes = new Uint8Array(preamble);

    bytes.set(MAGIC, 0);
    view.setUint32(4, 1, true); // Version 1
    view.setUint32(8, headerBytes.byteLength, true);
    bytes.set(headerBytes, 12);

    return new Blob([preamble, compressedGrid], {type: 'application/octet-stream'});
  }

  private async parseGoltFile(buffer: ArrayBuffer): Promise<{cols: number; rows: number; generation: number; grid: Uint32Array} | null> {
    if (buffer.byteLength < 12) {
      return null;
    }
    const view = new DataView(buffer);
    // Check magic "GoLT"
    if (view.getUint8(0) !== 0x47 || view.getUint8(1) !== 0x6F ||
        view.getUint8(2) !== 0x4C || view.getUint8(3) !== 0x54) {
      return null;
    }
    const version = view.getUint32(4, true);
    if (version !== 1) {
      return null;
    }
    const headerLen = view.getUint32(8, true);
    if (12 + headerLen > buffer.byteLength) {
      return null;
    }
    const headerJson = new TextDecoder().decode(new Uint8Array(buffer, 12, headerLen));
    const header = JSON.parse(headerJson);
    if (!header.cols || !header.rows) {
      return null;
    }
    // Decompress grid with deflate-raw
    const compressedGrid = buffer.slice(12 + headerLen);
    const ds = new DecompressionStream('deflate-raw');
    const writer = ds.writable.getWriter();
    writer.write(new Uint8Array(compressedGrid));
    writer.close();
    const rawGrid = await new Response(ds.readable).arrayBuffer();

    const expectedGridBytes = Math.ceil(header.cols / 4) * header.rows * 4;
    if (rawGrid.byteLength < expectedGridBytes) {
      return null;
    }
    const grid = new Uint32Array(rawGrid.slice(0, expectedGridBytes));

    return {
      cols: header.cols,
      rows: header.rows,
      generation: header.generation ?? 0,
      grid
    };
  }

  private parseLegacyJsonState(buffer: ArrayBuffer): {cols: number; rows: number; generation: number; grid: Uint32Array} | null {
    try {
      const text = new TextDecoder().decode(buffer);
      const data = JSON.parse(text);
      if (data.version !== 1 || !data.grid || !data.cols || !data.rows) {
        return null;
      }
      return {
        cols: data.cols,
        rows: data.rows,
        generation: data.generation ?? 0,
        grid: new Uint32Array(data.grid)
      };
    } catch (e) {
      console.warn('Failed to parse state file:', e);
      return null;
    }
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  private loadPrefs(): void {
    try {
      const raw = localStorage.getItem(HomePage.PREFS_KEY);
      if (!raw) {
        return;
      }
      const p = JSON.parse(raw);
      if (typeof p.speed === 'number' && p.speed >= 1) {
        this.speed = p.speed;
      }
      if (typeof p.recording === 'boolean') {
        this.recording = p.recording;
      }
      if ([
        'square',
        'round',
        'diamond',
        'vline',
        'hline'
      ].includes(p.brushShape)) {
        this.brushShape = p.brushShape;
      }
      if (['full', 'spray', 'outline'].includes(p.brushFill)) {
        this.brushFill = p.brushFill;
      }
    } catch (e) {
      console.warn('Failed to load home preferences:', e);
    }
  }

  private savePrefs(): void {
    try {
      const existing = JSON.parse(localStorage.getItem(HomePage.PREFS_KEY) ?? '{}');
      localStorage.setItem(HomePage.PREFS_KEY, JSON.stringify({
        ...existing,
        speed: this.speed,
        recording: this.recording,
        brushShape: this.brushShape,
        brushFill: this.brushFill
      }));
    } catch (e) {
      console.warn('Failed to save home preferences:', e);
    }
  }

  private readonly boundKeydown = (ev: KeyboardEvent) => this.handleKeydown(ev);
}
