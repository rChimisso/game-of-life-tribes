/* eslint-disable jsdoc/require-jsdoc */
import {DecimalPipe, NgTemplateOutlet} from '@angular/common';
import {ChangeDetectorRef, Component, ChangeDetectionStrategy, Input, Output, EventEmitter, OnChanges, SimpleChanges, ElementRef, NgZone} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {MatButtonModule} from '@angular/material/button';
import {MatCheckboxModule} from '@angular/material/checkbox';
import {MatExpansionModule} from '@angular/material/expansion';
import {MatIconModule} from '@angular/material/icon';
import {MatProgressBarModule} from '@angular/material/progress-bar';

import packageJson from '../../../../../../package.json';
import {Preset, PRESETS} from '../../model/preset';
import {Clause, NeighborCount, Rule, Ruleset, Tribe} from '../../model/rule';
import {BrushShape, MetricMessage} from '../../worker/webengine';

export interface SidebarEvent {
  action:
    | 'toggleRun'
    | 'restart'
    | 'selectTribe'
    | 'selectTribes'
    | 'setSpeed'
    | 'setMaxSpeed'
    | 'setRecording'
    | 'setGridSize'
    | 'download'
    | 'saveState'
    | 'loadState'
    | 'deleteMode'
    | 'updateRuleset'
    | 'stepBack'
    | 'stepForward'
    | 'setBrushSize'
    | 'setBrushShape'
    | 'setBrushFill'
    | 'togglePanMode'
    | 'cancelDownload'
    | 'applyPreset';
  value?: unknown;
}

@Component({
  selector: 'gol-sidebar',
  standalone: true,
  imports: [
    FormsModule,
    NgTemplateOutlet,
    MatButtonModule,
    MatCheckboxModule,
    MatExpansionModule,
    MatIconModule,
    MatProgressBarModule,
    DecimalPipe
  ],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(contextmenu)': '$event.preventDefault()'
  }
})
export class Sidebar implements OnChanges {
  @Input()
  public tribes: readonly Tribe[] = [];

  @Input()
  public drawTribes: string[] = [];

  @Input()
  public speed = 10;

  @Input()
  public maxSpeed = false;

  @Input()
  public recording = false;

  @Input()
  public running = false;

  @Input()
  public stepping = false;

  @Input()
  public backpressure = false;

  @Input()
  public rebuilding = false;

  @Input()
  public gridCols = 100;

  @Input()
  public gridRows = 100;

  @Input()
  public metrics: MetricMessage | null = null;

  @Input()
  public chunksSaving = false;

  @Input()
  public recordingAvailable = true;

  @Input()
  public frameByteSize = 0;

  @Input()
  public deleteMode = false;

  @Input()
  public panMode = false;

  @Input()
  public ruleset!: Ruleset;

  @Input()
  public brushSize = 1;

  @Input()
  public brushShape: BrushShape = 'square';

  @Input()
  public brushFill: 'full' | 'spray' | 'outline' = 'full';

  @Input()
  public skipAmount = 1;

  @Input()
  public downloadProgress = -1;

  @Input()
  public downloadSubProgress = -1;

  @Input()
  public downloadStatus = '';

  @Input()
  public downloadMainStatus = '';

  @Input()
  public maxBytes = Infinity;

  @Input()
  public storagePendingRawBytes = 0;

  @Input()
  public storageCompressedBytes = 0;

  @Input()
  public storageQuotaBytes = 0;

  @Input()
  public savingState = false;

  @Input()
  public loadingState = false;

  @Output()
  public readonly sidebarEvent = new EventEmitter<SidebarEvent>();

  public get downloading(): boolean {
    return this.downloadProgress >= 0;
  }

  public get recordingSize(): string {
    const total = this.storagePendingRawBytes + this.storageCompressedBytes;
    if (total <= 0) {
      return '0 B';
    }
    const parts: string[] = [];
    if (this.storagePendingRawBytes > 0) {
      parts.push(`${this.formatBytesDecimal(this.storagePendingRawBytes)} pending`);
    }
    if (this.storageCompressedBytes > 0) {
      parts.push(`${this.formatBytesDecimal(this.storageCompressedBytes)} compressed`);
    }
    return `${this.formatBytesDecimal(total)} (${parts.join(', ')})`;
  }

  public get storageTitleSize(): string {
    const total = this.storagePendingRawBytes + this.storageCompressedBytes;
    return this.formatBytesDecimal(total);
  }

  public get storageQuotaFormatted(): string {
    return this.formatBytes(this.storageQuotaBytes);
  }

  public get storagePendingFormatted(): string {
    return this.formatBytesDecimal(this.storagePendingRawBytes);
  }

  public get storageCompressedFormatted(): string {
    return this.formatBytesDecimal(this.storageCompressedBytes);
  }

  public get storageCompressedPct(): number {
    return this.storageQuotaBytes > 0 ? (this.storageCompressedBytes / this.storageQuotaBytes) * 100 : 0;
  }

  public get storagePendingPct(): number {
    return this.storageQuotaBytes > 0 ? (this.storagePendingRawBytes / this.storageQuotaBytes) * 100 : 0;
  }

  public get storageBarTooltip(): string {
    const pending = this.formatBytesDecimal(this.storagePendingRawBytes);
    const compressed = this.formatBytesDecimal(this.storageCompressedBytes);
    const quota = this.formatBytes(this.storageQuotaBytes);
    return `${pending} pending / ${compressed} compressed / ${quota} quota`;
  }

  /**
   * Powers of 2 (1024) — used for available/quota storage (conservative).
   *
   * @param bytes
   */
  private formatBytes(bytes: number): string {
    if (bytes < 1024) {
      return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(2)} KB`;
    }
    if (bytes < 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    }
    if (bytes < 1024 * 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    }
    return `${(bytes / (1024 * 1024 * 1024 * 1024)).toFixed(2)} TB`;
  }

  /**
   * Powers of 10 (1000) — used for occupied storage (conservative).
   *
   * @param bytes
   */
  private formatBytesDecimal(bytes: number): string {
    if (bytes < 1000) {
      return `${bytes} B`;
    }
    if (bytes < 1_000_000) {
      return `${(bytes / 1000).toFixed(2)} KB`;
    }
    if (bytes < 1_000_000_000) {
      return `${(bytes / 1_000_000).toFixed(2)} MB`;
    }
    if (bytes < 1_000_000_000_000) {
      return `${(bytes / 1_000_000_000).toFixed(2)} GB`;
    }
    return `${(bytes / 1_000_000_000_000).toFixed(2)} TB`;
  }

  public collapsed = true;

  public pendingCols = 100;

  public pendingRows = 100;

  public downloadCsv = true;

  public downloadSaves = true;

  public downloadMp4 = false;

  public downloadPng = false;

  public mp4Fps = 12;

  public mp4BitrateMbps = 2;

  // Sidebar resize
  public sidebarWidth = 300;

  // Bottom sheet (mobile)
  public sheetTranslate = 'calc(100% - 0px)';

  // Shortcuts
  public shortcutsExpanded = false;

  // Section collapse state
  public presetsExpanded = true;

  public tribesExpanded = true;

  public rulesExpanded = true;

  public metricsExpanded = true;

  public mp4SettingsExpanded = false;

  public mp4SettingsExpanded = false;

  // App info
  public readonly appVersion = packageJson.version;

  public readonly repoUrl = 'https://github.com/rChimisso/game-of-life-tribes';

  // Presets
  public readonly presets = PRESETS;

  public selectedPreset: Preset | null = null;

  // Tribe editing
  public editTribes: Tribe[] = [];

  public showTribeAdder = false;

  public newTribeId = '';

  public newTribeColor = '';

  public editingTribeIndex: number | null = null;

  public editingTribeName: string | null = null;

  // Rule editing
  public editRules: Rule<Tribe[]>[] = [];

  public expandedRuleIndex: number | null = null;

  public hasUnappliedTribes = false;

  public hasUnappliedRules = false;

  public readonly basicColors = [
    'ff0000',
    '00ff00',
    '0000ff',
    'ffff00',
    'ff00ff',
    '00ffff',
    'ff8800',
    '8800ff',
    '88ff00',
    'ff0088',
    '0088ff',
    'ffffff'
  ];

  private resizing = false;

  public get hasUnappliedGridSize(): boolean {
    return this.pendingCols !== this.gridCols || this.pendingRows !== this.gridRows;
  }

  public get gridSizeError(): string | null {
    const packedGridByteSize = Math.ceil(this.pendingCols / 4) * this.pendingRows * 4;

    if (packedGridByteSize > this.maxBytes) {
      return `Grid requires ${packedGridByteSize.toLocaleString()} bytes but GPU supports at most ${this.maxBytes.toLocaleString()}`;
    }
    if (this.pendingCols < 10 || this.pendingRows < 10) {
      return 'Minimum grid size is 10×10';
    }
    return null;
  }

  public get recordingGateMessage(): string | null {
    if (this.recordingAvailable) {
      return null;
    }
    return `Recording unavailable (frame size: ${this.frameByteSize.toLocaleString()} bytes, max: ${(1024 * 1024 * 1024).toLocaleString()})`;
  }

  public get mp4GateMessage(): string | null {
    const frames = this.metrics?.totalFrames || 0;
    if (frames === 0) {
      return null;
    }
    const bitrateBps = this.mp4BitrateMbps * 1_000_000;
    const overheadMultiplier = 1.1; // 10% safety margin for muxer overhead
    const estimatedBytes = (frames / this.mp4Fps) * (bitrateBps / 8) * overheadMultiplier;
    const TWO_GB = 2 * 1024 * 1024 * 1024;
    if (estimatedBytes > TWO_GB) {
      return `Estimated MP4 size (${this.formatBytes(estimatedBytes)}) exceeds the 2 GB memory limit — MP4 will be skipped. Increase FPS, lower bitrate, or record fewer frames`;
    }
    return null;
  }

  public get brushMaxSize(): number {
    return Math.max(1, Math.floor(Math.min(this.gridCols, this.gridRows) / 4));
  }

  private static readonly PREFS_KEY = 'golt-simfs';

  public constructor(private readonly elRef: ElementRef, private readonly zone: NgZone, private readonly cdr: ChangeDetectorRef) {
    this.loadPrefs();
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['ruleset'] && this.ruleset) {
      this.syncFromRuleset();
      this.hasUnappliedTribes = false;
      this.hasUnappliedRules = false;
    }
    if (changes['gridCols'] || changes['gridRows']) {
      this.pendingCols = this.gridCols;
      this.pendingRows = this.gridRows;
    }
  }

  public toggle(): void {
    this.collapsed = !this.collapsed;
    if (!this.collapsed) {
      this.sheetTranslate = '0px';
    }
  }

  public emit(action: SidebarEvent['action'], value?: unknown): void {
    this.sidebarEvent.emit({action,
      value});
  }

  public onTribeChange(id: string): void {
    this.emit('selectTribes', this.toggleTribeSelection(id));
  }

  public onSpeedChange(value: string): void {
    const n = parseInt(value, 10);
    if (n > 0) {
      this.emit('setSpeed', n);
    }
  }

  public onMaxSpeedChange(checked: boolean): void {
    this.emit('setMaxSpeed', checked);
  }

  public onRecordingChange(checked: boolean): void {
    this.emit('setRecording', checked);
  }

  public onGridSizeApply(): void {
    this.emit('setGridSize', {cols: this.pendingCols,
      rows: this.pendingRows});
  }

  public onDownload(): void {
    this.emit('download', {
      csv: this.downloadCsv,
      mp4: this.downloadMp4 && !this.mp4GateMessage,
      png: this.downloadPng,
      saves: this.downloadSaves,
      fps: this.mp4Fps,
      bitrate: this.mp4BitrateMbps * 1_000_000
    });
  }

  public onStepBack(): void {
    this.emit('stepBack', this.skipAmount);
  }

  public onStepForward(): void {
    this.emit('stepForward', this.skipAmount);
  }

  public onBrushSizeChange(value: string): void {
    const n = Math.min(Math.max(1, parseInt(value, 10) || 1), this.brushMaxSize);
    if (n > 0) {
      this.emit('setBrushSize', n);
    }
  }

  public onBrushShapeChange(shape: BrushShape): void {
    this.emit('setBrushShape', shape);
  }

  public onBrushFillChange(fill: 'full' | 'spray' | 'outline'): void {
    this.emit('setBrushFill', fill);
  }

  public onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      this.emit('loadState', reader.result as ArrayBuffer);
      input.value = '';
    };
    reader.readAsArrayBuffer(file);
  }

  public startAddTribe(): void {
    this.showTribeAdder = true;
    this.newTribeId = '';
    this.newTribeColor = this.randomColor();
  }

  public randomColor(): string {
    return Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
  }

  public isValidNewTribe(): boolean {
    if (!this.newTribeId || !this.newTribeColor || this.newTribeColor.length !== 6) {
      return false;
    }
    const id = this.newTribeId.toLowerCase().replace(/[^a-z0-9]/g, '');
    return id.length > 0 && !this.editTribes.some(t => t.id === id);
  }

  public confirmAddTribe(): void {
    const id = this.newTribeId.toLowerCase().replace(/[^a-z0-9]/g, '');
    this.editTribes.push({id,
      color: this.newTribeColor});
    this.showTribeAdder = false;
    this.hasUnappliedTribes = true;
  }

  public removeTribe(index: number): void {
    const {id} = (this.editTribes[index]!);
    if (id === 'dead') {
      return;
    }
    this.editTribes.splice(index, 1);
    this.editRules = this.editRules.filter(r => {
      this.removeTribeIdFromClause(r.clause, id);
      return r.tribe !== id;
    });
    this.hasUnappliedTribes = true;
    this.hasUnappliedRules = true;
  }

  public startEditTribe(index: number): void {
    if (this.editingTribeIndex === index) {
      this.editingTribeIndex = null;
      this.editingTribeName = null;
    } else {
      this.editingTribeIndex = index;
      this.editingTribeName = this.editTribes[index]!.id;
    }
  }

  public updateTribeName(index: number, newName: string): void {
    const clean = newName.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!clean || clean === 'dead' || this.editTribes.some((t, i) => i !== index && t.id === clean)) {
      return;
    }
    const oldId = this.editTribes[index]!.id;
    this.editTribes[index] = {...this.editTribes[index]!,
      id: clean};
    for (const rule of this.editRules) {
      if (rule.tribe === oldId) {
        rule.tribe = clean;
      }
      this.renameTribeInClause(rule.clause, oldId, clean);
    }
    this.editingTribeName = clean;
    this.hasUnappliedTribes = true;
  }

  public updateTribeColor(index: number, color: string): void {
    const c = color.toLowerCase().replace(/[^0-9a-f]/g, '');
    if (c.length === 6) {
      this.editTribes[index] = {...this.editTribes[index]!,
        color: c};
      this.hasUnappliedTribes = true;
    }
  }

  public addRule(): void {
    const dt = this.editTribes.find(t => t.id !== 'dead')?.id ?? 'dead';
    this.editRules.push({
      clause: {kind: 'and',
        clauses: [
          {kind: 'is',
            tribes: [dt]},
          {
            kind: 'count',
            tribes: [dt],
            interval: [2, 3]
          }
        ]},
      tribe: dt
    });
    this.expandedRuleIndex = this.editRules.length - 1;
    this.hasUnappliedRules = true;
  }

  public removeRule(index: number): void {
    this.editRules.splice(index, 1);
    if (this.expandedRuleIndex === index) {
      this.expandedRuleIndex = null;
    } else if (this.expandedRuleIndex !== null && this.expandedRuleIndex > index) {
      this.expandedRuleIndex--;
    }
    this.hasUnappliedRules = true;
  }

  public setRuleOutput(index: number, tribe: string): void {
    this.editRules[index] = {...this.editRules[index]!,
      tribe};
    this.hasUnappliedRules = true;
  }

  public toggleRuleExpand(index: number): void {
    this.expandedRuleIndex = this.expandedRuleIndex === index ? null : index;
  }

  public changeClauseKind(ruleIndex: number, path: number[], newKind: string): void {
    const dt = this.editTribes.find(t => t.id !== 'dead')?.id ?? 'dead';
    let nc: Clause<Tribe[]>;
    switch (newKind) {
      case 'is': nc = {kind: 'is',
        tribes: [dt]}; break;
      case 'count': nc = {
        kind: 'count',
        tribes: [dt],
        interval: [0, 8]
      }; break;
      case 'equality': nc = {
        kind: 'equality',
        tribe1: [dt],
        tribe2: [dt]
      }; break;
      case 'not': nc = {kind: 'not',
        clause: {kind: 'is',
          tribes: [dt]} }; break;
      case 'and': nc = {kind: 'and',
        clauses: [
          {kind: 'is',
            tribes: [dt]},
          {
            kind: 'count',
            tribes: [dt],
            interval: [0, 8]
          }
        ]}; break;
      case 'or': nc = {kind: 'or',
        clauses: [
          {kind: 'is',
            tribes: [dt]},
          {kind: 'is',
            tribes: [dt]}
        ]}; break;
      default: return;
    }
    this.setClauseAtPath(this.editRules[ruleIndex]!, path, nc);
    this.hasUnappliedRules = true;
  }

  public toggleClauseTribe(ruleIndex: number, path: number[], tribeId: string): void {
    const clause = this.getClauseAtPath(this.editRules[ruleIndex]!.clause, path);
    if (clause.kind !== 'is' && clause.kind !== 'count') {
      return;
    }
    const idx = clause.tribes.indexOf(tribeId);
    if (idx >= 0) {
      if (clause.tribes.length > 1) {
        clause.tribes.splice(idx, 1);
      }
    } else {
      clause.tribes.push(tribeId);
    }
    this.hasUnappliedRules = true;
  }

  public toggleClauseEqTribe(ruleIndex: number, path: number[], group: 1 | 2, tribeId: string): void {
    const clause = this.getClauseAtPath(this.editRules[ruleIndex]!.clause, path);
    if (clause.kind !== 'equality') {
      return;
    }
    const arr = group === 1 ? clause.tribe1 : clause.tribe2;
    const idx = arr.indexOf(tribeId);
    if (idx >= 0) {
      if (arr.length > 1) {
        arr.splice(idx, 1);
      }
    } else {
      arr.push(tribeId);
    }
    this.hasUnappliedRules = true;
  }

  public setClauseInterval(ruleIndex: number, path: number[], which: 0 | 1, value: string): void {
    const clause = this.getClauseAtPath(this.editRules[ruleIndex]!.clause, path);
    if (clause.kind !== 'count') {
      return;
    }
    const n = Math.max(0, Math.min(8, parseInt(value, 10) || 0)) as NeighborCount;
    clause.interval[which] = n;
    this.hasUnappliedRules = true;
  }

  public addChildClause(ruleIndex: number, path: number[]): void {
    const clause = this.getClauseAtPath(this.editRules[ruleIndex]!.clause, path);
    if (clause.kind !== 'and' && clause.kind !== 'or') {
      return;
    }
    const dt = this.editTribes.find(t => t.id !== 'dead')?.id ?? 'dead';
    (clause.clauses as Clause<Tribe[]>[]).push({kind: 'is',
      tribes: [dt]});
    this.hasUnappliedRules = true;
  }

  public removeChildClause(ruleIndex: number, path: number[]): void {
    if (path.length === 0) {
      return;
    }
    const parentPath = path.slice(0, -1);
    const childIdx = path[path.length - 1]!;
    const parent = this.getClauseAtPath(this.editRules[ruleIndex]!.clause, parentPath);
    if ((parent.kind === 'and' || parent.kind === 'or') && parent.clauses.length > 2) {
      (parent.clauses as Clause<Tribe[]>[]).splice(childIdx, 1);
      this.hasUnappliedRules = true;
    }
  }

  public applyTribes(): void {
    this.emit('updateRuleset', {
      tribes: this.editTribes.map(t => ({...t})),
      rules: structuredClone(this.editRules),
      cols: this.ruleset.cols,
      rows: this.ruleset.rows
    });
    this.hasUnappliedTribes = false;
  }

  public restoreTribes(): void {
    this.editTribes = this.ruleset.tribes.map(t => ({...t}));
    this.editingTribeIndex = null;
    this.editingTribeName = null;
    this.showTribeAdder = false;
    this.hasUnappliedTribes = false;
  }

  public applyPreset(): void {
    if (this.selectedPreset) {
      this.emit('applyPreset', this.selectedPreset);
      this.selectedPreset = null;
    }
  }

  public restorePreset(): void {
    this.selectedPreset = null;
  }

  public applyRules(): void {
    this.emit('updateRuleset', {
      tribes: this.editTribes.map(t => ({...t})),
      rules: structuredClone(this.editRules),
      cols: this.ruleset.cols,
      rows: this.ruleset.rows
    });
    this.hasUnappliedRules = false;
  }

  public restoreRules(): void {
    this.editRules = structuredClone(this.ruleset.rules);
    this.expandedRuleIndex = null;
    this.hasUnappliedRules = false;
  }

  public restoreGridSize(): void {
    this.pendingCols = this.gridCols;
    this.pendingRows = this.gridRows;
  }

  public clauseSummary(clause: Clause<Tribe[]>): string {
    const s = this.clauseStr(clause);
    return s.length > 50 ? `${s.substring(0, 47) }…` : s;
  }

  public getTribeColor(tribeId: string): string {
    return this.editTribes.find(t => t.id === tribeId)?.color ?? '888888';
  }

  public getContrastColor(hex: string): string {
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    // Relative luminance (sRGB)
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#111' : '#fff';
  }

  public onSheetDragStart(event: TouchEvent): void {
    const startY = event.touches[0]!.clientY;
    const panel = this.elRef.nativeElement.querySelector('.sidebar-panel') as HTMLElement;
    const panelHeight = panel.offsetHeight;
    const currentTranslateY = panel.getBoundingClientRect().bottom - window.innerHeight;

    panel.classList.add('dragging');

    const onMove = (e: TouchEvent) => {
      e.preventDefault();
      const dy = e.touches[0]!.clientY - startY;
      const newTranslate = Math.max(0, currentTranslateY + dy);
      this.sheetTranslate = `${newTranslate}px`;
      this.cdr.detectChanges();
    };

    const onEnd = (e: TouchEvent) => {
      panel.classList.remove('dragging');
      const dy = e.changedTouches[0]!.clientY - startY;
      const finalTranslate = Math.max(0, currentTranslateY + dy);
      // If dragged down more than 50% of the panel height, close.
      if (finalTranslate > panelHeight * 0.5) {
        this.collapsed = true;
        this.sheetTranslate = '0px';
      } else {
        // Stay at dragged position.
        this.sheetTranslate = `${finalTranslate}px`;
      }
      this.cdr.detectChanges();
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
    };

    document.addEventListener('touchmove', onMove, {passive: false});
    document.addEventListener('touchend', onEnd);
  }

  public onResizeStart(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.resizing = true;
    document.body.style.userSelect = 'none';
    const startX = event.clientX;
    const startWidth = this.sidebarWidth;

    const onMove = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      this.sidebarWidth = Math.max(220, Math.min(600, startWidth + e.clientX - startX));
      this.cdr.detectChanges();
    };

    const onUp = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      this.resizing = false;
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMove, true);
      document.removeEventListener('mouseup', onUp, true);
    };

    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('mouseup', onUp, true);
  }

  private toggleTribeSelection(id: string): string[] {
    if (id === 'dead') {
      return ['dead'];
    }
    // If currently in delete mode (only 'dead' selected), start fresh.
    if (this.drawTribes.length === 1 && this.drawTribes[0] === 'dead') {
      return [id];
    }
    const current = this.drawTribes.filter(t => t !== 'dead');
    const idx = current.indexOf(id);
    if (idx >= 0) {
      // Don't allow deselecting the last tribe.
      if (current.length > 1) {
        current.splice(idx, 1);
      }
      return current;
    }
    return [...current, id];
  }

  private syncFromRuleset(): void {
    this.editTribes = this.ruleset.tribes.map(t => ({...t}));
    this.editRules = structuredClone(this.ruleset.rules);
    this.pendingCols = this.ruleset.cols;
    this.pendingRows = this.ruleset.rows;
  }

  private removeTribeIdFromClause(clause: Clause<Tribe[]>, tribeId: string): void {
    if (clause.kind === 'is' || clause.kind === 'count') {
      const idx = clause.tribes.indexOf(tribeId);
      if (idx >= 0 && clause.tribes.length > 1) {
        clause.tribes.splice(idx, 1);
      }
    } else if (clause.kind === 'equality') {
      const idx1 = clause.tribe1.indexOf(tribeId);
      if (idx1 >= 0 && clause.tribe1.length > 1) {
        clause.tribe1.splice(idx1, 1);
      }
      const idx2 = clause.tribe2.indexOf(tribeId);
      if (idx2 >= 0 && clause.tribe2.length > 1) {
        clause.tribe2.splice(idx2, 1);
      }
    } else if (clause.kind === 'not') {
      this.removeTribeIdFromClause(clause.clause, tribeId);
    } else if (clause.kind === 'and' || clause.kind === 'or') {
      for (const child of clause.clauses) {
        this.removeTribeIdFromClause(child, tribeId);
      }
    }
  }

  private renameTribeInClause(clause: Clause<Tribe[]>, oldId: string, newId: string): void {
    if (clause.kind === 'is' || clause.kind === 'count') {
      const idx = clause.tribes.indexOf(oldId);
      if (idx >= 0) {
        clause.tribes[idx] = newId;
      }
    } else if (clause.kind === 'equality') {
      const idx1 = clause.tribe1.indexOf(oldId);
      if (idx1 >= 0) {
        clause.tribe1[idx1] = newId;
      }
      const idx2 = clause.tribe2.indexOf(oldId);
      if (idx2 >= 0) {
        clause.tribe2[idx2] = newId;
      }
    } else if (clause.kind === 'not') {
      this.renameTribeInClause(clause.clause, oldId, newId);
    } else if (clause.kind === 'and' || clause.kind === 'or') {
      for (const child of clause.clauses) {
        this.renameTribeInClause(child, oldId, newId);
      }
    }
  }

  private getClauseAtPath(root: Clause<Tribe[]>, path: number[]): Clause<Tribe[]> {
    let current: Clause<Tribe[]> = root;
    for (const idx of path) {
      if (current.kind === 'and' || current.kind === 'or') {
        current = current.clauses[idx]!;
      } else if (current.kind === 'not') {
        current = current.clause;
      }
    }
    return current;
  }

  private setClauseAtPath(rule: Rule<Tribe[]>, path: number[], newClause: Clause<Tribe[]>): void {
    if (path.length === 0) {
      rule.clause = newClause;
      return;
    }
    const parent = this.getClauseAtPath(rule.clause, path.slice(0, -1));
    const lastIdx = path[path.length - 1]!;
    if (parent.kind === 'and' || parent.kind === 'or') {
      (parent.clauses as Clause<Tribe[]>[])[lastIdx] = newClause;
    } else if (parent.kind === 'not') {
      (parent as {kind: 'not'; clause: Clause<Tribe[]>}).clause = newClause;
    }
  }

  private clauseStr(clause: Clause<Tribe[]>): string {
    switch (clause.kind) {
      case 'is': return `is ${clause.tribes.join('/')}`;
      case 'count': return `${clause.tribes.join('/')} ∈ [${clause.interval[0]},${clause.interval[1]}]`;
      case 'equality': return `#${clause.tribe1.join('/')} = #${clause.tribe2.join('/')}`;
      case 'not': return `¬(${this.clauseStr(clause.clause)})`;
      case 'and': return clause.clauses.map(c => this.clauseStr(c)).join(' ∧ ');
      case 'or': return clause.clauses.map(c => this.clauseStr(c)).join(' ∨ ');
      default: return '';
    }
  }

  public clauseTribes(clause: Clause<Tribe[]>): string[] {
    const ids = new Set<string>();
    this.collectClauseTribes(clause, ids);
    return [...ids];
  }

  private collectClauseTribes(clause: Clause<Tribe[]>, ids: Set<string>): void {
    switch (clause.kind) {
      case 'is':
        clause.tribes.forEach(t => ids.add(t));
        break;
      case 'count':
        clause.tribes.forEach(t => ids.add(t));
        break;
      case 'equality':
        clause.tribe1.forEach(t => ids.add(t));
        clause.tribe2.forEach(t => ids.add(t));
        break;
      case 'not':
        this.collectClauseTribes(clause.clause, ids);
        break;
      case 'and':
      case 'or':
        clause.clauses.forEach(c => this.collectClauseTribes(c, ids));
        break;
    }
  }

  public toggleSection(section: 'presets' | 'tribes' | 'rules' | 'metrics' | 'shortcuts' | 'mp4Settings'): void {
    switch (section) {
      case 'presets': this.presetsExpanded = !this.presetsExpanded; break;
      case 'tribes': this.tribesExpanded = !this.tribesExpanded; break;
      case 'rules': this.rulesExpanded = !this.rulesExpanded; break;
      case 'metrics': this.metricsExpanded = !this.metricsExpanded; break;
      case 'shortcuts': this.shortcutsExpanded = !this.shortcutsExpanded; break;
      case 'mp4Settings': this.mp4SettingsExpanded = !this.mp4SettingsExpanded; break;
    }
    this.savePrefs();
  }

  public savePrefs(): void {
    try {
      const existing = JSON.parse(localStorage.getItem(Sidebar.PREFS_KEY) ?? '{}');
      localStorage.setItem(Sidebar.PREFS_KEY, JSON.stringify({
        ...existing,
        shortcutsExpanded: this.shortcutsExpanded,
        presetsExpanded: this.presetsExpanded,
        tribesExpanded: this.tribesExpanded,
        rulesExpanded: this.rulesExpanded,
        metricsExpanded: this.metricsExpanded,
        downloadCsv: this.downloadCsv,
        downloadSaves: this.downloadSaves,
        downloadMp4: this.downloadMp4,
        downloadPng: this.downloadPng,
        mp4Fps: this.mp4Fps,
        mp4BitrateMbps: this.mp4BitrateMbps,
        mp4SettingsExpanded: this.mp4SettingsExpanded,
        skipAmount: this.skipAmount
      }));
    } catch (e) {
      console.warn('Failed to save sidebar preferences:', e);
    }
  }

  private loadPrefs(): void {
    try {
      const raw = localStorage.getItem(Sidebar.PREFS_KEY);
      if (!raw) {
        return;
      }
      const p = JSON.parse(raw);
      if (typeof p.shortcutsExpanded === 'boolean') {
        this.shortcutsExpanded = p.shortcutsExpanded;
      }
      if (typeof p.presetsExpanded === 'boolean') {
        this.presetsExpanded = p.presetsExpanded;
      }
      if (typeof p.tribesExpanded === 'boolean') {
        this.tribesExpanded = p.tribesExpanded;
      }
      if (typeof p.rulesExpanded === 'boolean') {
        this.rulesExpanded = p.rulesExpanded;
      }
      if (typeof p.metricsExpanded === 'boolean') {
        this.metricsExpanded = p.metricsExpanded;
      }
      if (typeof p.downloadCsv === 'boolean') {
        this.downloadCsv = p.downloadCsv;
      }
      if (typeof p.downloadSaves === 'boolean') {
        this.downloadSaves = p.downloadSaves;
      }
      if (typeof p.downloadMp4 === 'boolean') {
        this.downloadMp4 = p.downloadMp4;
      }
      if (typeof p.downloadPng === 'boolean') {
        this.downloadPng = p.downloadPng;
      }
      if (typeof p.mp4Fps === 'number' && p.mp4Fps >= 1 && p.mp4Fps <= 60) {
        this.mp4Fps = p.mp4Fps;
      }
      if (typeof p.mp4BitrateMbps === 'number' && p.mp4BitrateMbps >= 0.5 && p.mp4BitrateMbps <= 50) {
        this.mp4BitrateMbps = p.mp4BitrateMbps;
      }
      if (typeof p.mp4SettingsExpanded === 'boolean') {
        this.mp4SettingsExpanded = p.mp4SettingsExpanded;
      }
      if (typeof p.mp4BitrateMbps === 'number' && p.mp4BitrateMbps >= 0.5 && p.mp4BitrateMbps <= 50) {
        this.mp4BitrateMbps = p.mp4BitrateMbps;
      }
      if (typeof p.mp4SettingsExpanded === 'boolean') {
        this.mp4SettingsExpanded = p.mp4SettingsExpanded;
      }
      if (typeof p.skipAmount === 'number' && p.skipAmount >= 1) {
        this.skipAmount = p.skipAmount;
      }
    } catch (e) {
      console.warn('Failed to load sidebar preferences:', e);
    }
  }
}
