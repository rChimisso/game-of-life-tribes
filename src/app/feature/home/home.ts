import {ChangeDetectorRef, Component, HostListener, OnDestroy, ViewChild} from '@angular/core';
import {MatIconModule} from '@angular/material/icon';
import {MatProgressBarModule} from '@angular/material/progress-bar';
import {RouterModule} from '@angular/router';

import {Engine} from './component/engine/engine';
import {Sidebar, SidebarEvent} from './component/sidebar/sidebar';
import {DEAD_TRIBE, Ruleset, Tribe} from './model/rule';
import {MetricMessage, LimitsMessage, RecordingMessage, SnapshotMessage, SteppingMessage, BrushShape} from './worker/webengine';

@Component({
  selector: 'gol-home',
  standalone: true,
  imports: [
    RouterModule,
    Engine,
    Sidebar,
    MatIconModule,
    MatProgressBarModule
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
        color: '00ff00'},
      {id: 'green',
        color: '0000ff'}
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

  drawTribes: string[] = ['classic'];

  deleteMode = false;

  panMode = false;

  latestMetrics: MetricMessage | null = null;

  brushSize = 1;

  brushShape: BrushShape = 'square';

  brushFill: 'full' | 'spray' | 'outline' = 'full';

  skipAmount = 1;

  downloadProgress = -1;

  downloadStatus = '';

  maxCells = Infinity;

  stepping = false;

  private drawTribeIndex = 1;

  private metricsHistory: MetricMessage[] = [];

  private readonly boundKeydown = (ev: KeyboardEvent) => this.handleKeydown(ev);

  constructor(private readonly cdr: ChangeDetectorRef) {
    document.addEventListener('keydown', this.boundKeydown, true);
  }

  ngOnDestroy(): void {
    document.removeEventListener('keydown', this.boundKeydown, true);
  }

  get tribes(): readonly Tribe[] {
    return this.ruleset.tribes;
  }

  get effectiveSpeed(): number {
    return this.maxSpeed ? -1 : this.speed;
  }

  @HostListener('mousedown', ['$event'])
  onHostMousedown(ev: MouseEvent): void {
    const target = ev.target as HTMLElement;
    if (target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement) {
      return;
    }
    // Defer blur so it fires after the browser sets focus on the clicked element.
    setTimeout(() => (document.activeElement as HTMLElement)?.blur?.());
  }

  private handleKeydown(ev: KeyboardEvent): void {
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
      default:
        handled = false;
    }
    if (handled) {
      ev.preventDefault();
      ev.stopPropagation();
      (document.activeElement as HTMLElement)?.blur?.();
      this.cdr.markForCheck();
    }
  }

  onMetrics(data: MetricMessage): void {
    this.latestMetrics = data;
    this.metricsHistory.push(data);
    this.cdr.markForCheck();
  }

  onLimits(data: LimitsMessage): void {
    this.maxCells = data.maxCells;
    this.cdr.markForCheck();
  }

  onStepping(data: SteppingMessage): void {
    this.stepping = data.active;
    this.cdr.markForCheck();
  }

  onSnapshot(snap: SnapshotMessage): void {
    if (this.pendingSnapshotResolve) {
      this.pendingSnapshotResolve(snap);
      this.pendingSnapshotResolve = null;
    } else {
      const state = {
        version: 1,
        generation: snap.generation,
        cols: snap.cols,
        rows: snap.rows,
        tribes: [...this.tribes],
        rules: this.ruleset.rules,
        grid: Array.from(snap.grid)
      };
      this.downloadFile(`gol-state-gen${snap.generation}.json`, JSON.stringify(state), 'application/json');
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
        break;
      case 'setMaxSpeed':
        this.maxSpeed = ev.value as boolean;
        break;
      case 'setGridSize': {
        const {cols, rows} = ev.value as {cols: number; rows: number};
        this.ruleset = {
          ...this.ruleset,
          cols,
          rows
        };
        this.metricsHistory = [];
        this.latestMetrics = null;
        this.clampBrushSize();
        break;
      }
      case 'download':
        this.downloadZip(ev.value as {csv: boolean; json: boolean; frames: boolean; mp4: boolean; png: boolean; fps: number});
        break;
      case 'saveState':
        this.engine.requestSnapshot();
        break;
      case 'loadState':
        this.loadState(ev.value as string);
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
        this.ruleset = newRuleset;
        if (!newRuleset.tribes.some(t => this.drawTribes.includes(t.id))) {
          this.drawTribes = [newRuleset.tribes.find(t => t.id !== 'dead')?.id ?? 'dead'];
        }
        this.drawTribeIndex = newRuleset.tribes.findIndex(t => t.id === this.drawTribes[0]);
        this.metricsHistory = [];
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
        break;
      case 'setBrushFill':
        this.brushFill = ev.value as 'full' | 'spray' | 'outline';
        break;
    }
  }

  private toggleRun(): void {
    this.state = this.state === 'paused' ? 'running' : 'paused';
  }

  private restart(): void {
    this.state = 'paused';
    this.ruleset = {...this.ruleset};
    this.metricsHistory = [];
    this.latestMetrics = null;
  }

  private clampBrushSize(): void {
    const max = Math.max(1, Math.floor(Math.max(this.ruleset.cols, this.ruleset.rows) / 4));
    if (this.brushSize > max) {
      this.brushSize = max;
    }
  }

  private downloadZip(opts: {csv: boolean; json: boolean; frames: boolean; mp4: boolean; png: boolean; fps: number}): void {
    const needFrames = opts.frames || opts.mp4 || opts.png || opts.csv || opts.json;

    // Pause the simulation so the download captures a consistent state.
    if (this.state === 'running') {
      this.state = 'paused';
    }

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
      worker.onmessage = (e: MessageEvent) => {
        if (e.data.type === 'progress') {
          this.downloadProgress = e.data.percent;
          this.downloadStatus = e.data.status ?? '';
          this.cdr.markForCheck();
        } else if (e.data.type === 'done') {
          this.downloadBlob(new Blob([e.data.zip]), 'gol-export.zip');
          this.downloadProgress = -1;
          this.downloadStatus = '';
          this.cdr.markForCheck();
          worker.terminate();
        }
      };
      const gridBuf = snap.grid;
      const recFrames = rec && rec.frames.length > 0 ? rec.frames : null;
      const transferables: ArrayBuffer[] = [];
      if (gridBuf?.buffer?.byteLength > 0) {
        transferables.push(gridBuf.buffer);
      }
      if (recFrames) {
        for (const f of recFrames) {
          if (f.buffer.byteLength > 0) {
            transferables.push(f.buffer);
          }
        }
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
        recording: recFrames ? {
          frames: recFrames,
          startGeneration: rec!.startGeneration,
          cols: rec!.cols,
          rows: rec!.rows
        } : null,
        tribes: this.tribes.map(t => ({id: t.id,
          color: t.color})),
        rules: this.ruleset.rules,
        metricsHistory: this.metricsHistory
      }, transferables);
    });
  }

  private loadState(jsonString: string): void {
    try {
      const data = JSON.parse(jsonString);
      if (data.version !== 1 || !data.grid || !data.cols || !data.rows) {
        return;
      }
      // Update ruleset if grid size changed.
      if (data.cols !== this.ruleset.cols || data.rows !== this.ruleset.rows) {
        this.ruleset = {
          ...this.ruleset,
          cols: data.cols,
          rows: data.rows
        };
      }
      // Wait a tick for the engine to rebuild, then load the grid.
      setTimeout(() => {
        const grid = new Uint32Array(data.grid);
        this.engine.loadSnapshot(grid, data.generation ?? 0);
        this.metricsHistory = [];
        this.latestMetrics = null;
        this.cdr.markForCheck();
      }, 100);
    } catch {
      // Invalid JSON — ignore.
    }
  }

  private downloadFile(filename: string, content: string, mimeType: string): void {
    const blob = new Blob([content], {type: mimeType});
    this.downloadBlob(blob, filename);
  }

  private downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}
