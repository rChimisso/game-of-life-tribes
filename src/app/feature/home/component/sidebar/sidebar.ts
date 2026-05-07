/* eslint-disable jsdoc/require-jsdoc */
import {CdkDragDrop, DragDropModule, moveItemInArray} from '@angular/cdk/drag-drop';
import {DecimalPipe} from '@angular/common';
import {ChangeDetectorRef, Component, ChangeDetectionStrategy, Input, Output, EventEmitter, OnChanges, OnDestroy, SimpleChanges, ElementRef, NgZone} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {MatButtonModule} from '@angular/material/button';
import {MatExpansionModule} from '@angular/material/expansion';
import {MatIconModule} from '@angular/material/icon';
import {MatProgressBarModule} from '@angular/material/progress-bar';

import {ApplyRestoreButtons} from '../../../../shared/component/apply-restore/button-pair';
import {Button} from '../../../../shared/component/button/button';
import {CheckboxComponent} from '../../../../shared/component/checkbox/checkbox';
import {ExclusiveButtonGroup} from '../../../../shared/component/exclusive-button-group/exclusive-button-group';
import {InputComponent} from '../../../../shared/component/input/input';
import {StorageBar} from '../../../../shared/component/storage-bar/storage-bar';
import {TribeSwatch} from '../../../../shared/component/tribe-swatch/tribe-swatch';
import {BitsPerCell, gridByteSize, gridFormatFromBits, GridFormatMetadata, SUPPORTED_SIMULATION_BITS_PER_CELL, validatePackingAgainstStateCount} from '../../model/grid-format';
import {Preset, PRESETS} from '../../model/preset';
import {AND_CLAUSE_KIND, Clause, COMPARISON_CLAUSE_KIND, COUNT_CLAUSE_KIND, DEAD_TRIBE_ID, EditableTribe, EMPTY_CLAUSE, EMPTY_CLAUSE_KIND, EXACTLY_CLAUSE_KIND, IS_CLAUSE_KIND, MAX_CLAUSE_KIND, MIN_CLAUSE_KIND, NONE_CLAUSE_KIND, NOT_CLAUSE_KIND, OR_CLAUSE_KIND, Rule, Ruleset, Tribe, XOR_CLAUSE_KIND} from '../../model/rule';
import {TribeSaveEvent} from '../../model/tribe-save-event';
import {BrushShape, MetricMessage} from '../../model/worker-message';
import {RECORDING_MAX_FRAME_BYTES} from '../../worker/recording-limits';
import {HomeFooter} from '../footer/footer';
import {PresetButton} from '../preset-button/preset-button';
import {RuleCard, RuleChangeEvent, RuleStateChangeEvent} from '../rule-card/rule-card';
import {HomeSection} from '../section/section';
import {TribeEntry} from '../tribe-entry/tribe-entry';

import {ExclusiveButtonOption} from '~gol/shared/component/exclusive-button-group/model/exclusive-button-option';
import {LabelValue} from '~gol/shared/component/label-value/label-value';
import {StorageBarSegment} from '~gol/shared/component/storage-bar/model/storage-bar-segment';

interface SidebarEvent {
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
    | 'setPacking'
    | 'applyPreset';
  value?: unknown;
}

interface DownloadFrameRange {
  startFrame: number;
  endFrame: number;
}

@Component({
  selector: 'gol-sidebar',
  standalone: true,
  imports: [
    FormsModule,
    ApplyRestoreButtons,
    HomeSection,
    RuleCard,
    StorageBar,
    TribeEntry,
    Button,
    InputComponent,
    CheckboxComponent,
    ExclusiveButtonGroup,
    MatButtonModule,
    MatExpansionModule,
    MatIconModule,
    MatProgressBarModule,
    DragDropModule,
    DecimalPipe,
    LabelValue,
    PresetButton,
    HomeFooter,
    TribeSwatch
  ],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(contextmenu)': '$event.preventDefault()'
  }
})
export class Sidebar implements OnChanges, OnDestroy {
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
  public simulationGridFormat: GridFormatMetadata = {bitsPerCell: 8};

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
  public vramBudgetBytes = Infinity;

  @Input()
  public vramSimulationBytes = 0;

  @Input()
  public vramRecordingBytes = 0;

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

  public collapsed = true;

  public pendingCols = 100;

  public pendingRows = 100;

  public pendingSimulationBitsPerCell: BitsPerCell = 8;

  public downloadCsv = true;

  public downloadSaves = true;

  public downloadMp4 = false;

  public downloadPng = false;

  public downloadAllFrames = true;

  public downloadStartFrame = 1;

  public downloadEndFrame = 1;

  public mp4Fps = 12;

  public mp4BitrateMbps = 2;

  // Sidebar resize
  public sidebarWidth = 300;

  // Bottom sheet (mobile)
  public sheetTranslate = 'calc(100% - 0px)';

  public suppressClosedTransition = false;

  // Shortcuts
  public shortcutsExpanded = false;

  // Section collapse state
  public presetsExpanded = true;

  public tribesExpanded = true;

  public rulesExpanded = true;

  public metricsExpanded = true;

  public packingExpanded = true;

  public mp4SettingsExpanded = false;

  public downloadSelectionExpanded = true;

  // Presets
  public readonly presets = PRESETS;

  public readonly simulationPackingOptions = SUPPORTED_SIMULATION_BITS_PER_CELL;

  public selectedPreset: Preset | null = null;

  // Tribe editing
  public editTribes: EditableTribe[] = [];

  public showTribeAdder = false;

  public newTribeId = '';

  public newTribeColor = '';

  // Rule editing
  public editRules: Rule<Tribe[]>[] = [];

  public expandedRuleIndex: number | null = null;

  public draggingRuleIndex: number | null = null;

  public hasUnappliedTribes = false;

  public hasUnappliedRules = false;

  private readonly ruleStatesByKey = new Map<string, {dirty: boolean; invalid: boolean}>();

  public readonly basicColors = [
    '000088',
    '0000ff',
    '008800',
    '008888',
    '0088ff',
    '00ff00',
    '00ff88',
    '00ffff',
    '880000',
    '880088',
    '8800ff',
    '888800',
    '888888',
    '8888ff',
    '88ff00',
    '88ff88',
    '88ffff',
    'ff0000',
    'ff0088',
    'ff00ff',
    'ff8800',
    'ff8888',
    'ff88ff',
    'ffff00',
    'ffff88',
    'ffffff'
  ];

  public readonly brushShapeOptions: readonly ExclusiveButtonOption<BrushShape>[] = [
    {
      value: 'square',
      tooltip: 'Square',
      icon: 'square'
    },
    {
      value: 'round',
      tooltip: 'Round',
      icon: 'circle'
    },
    {
      value: 'diamond',
      tooltip: 'Diamond',
      icon: 'square',
      iconStyle: {
        transform: 'rotate(45deg)'
      }
    },
    {
      value: 'vline',
      tooltip: 'Vertical Line',
      icon: 'horizontal_rule',
      iconStyle: {
        transform: 'rotate(90deg)'
      }
    },
    {
      value: 'hline',
      tooltip: 'Horizontal Line',
      icon: 'horizontal_rule'
    }
  ];

  public readonly brushFillOptions: readonly ExclusiveButtonOption<'full' | 'spray' | 'outline'>[] = [
    {
      value: 'full',
      tooltip: 'Full',
      label: 'Full'
    },
    {
      value: 'spray',
      tooltip: 'Spray',
      label: 'Spray'
    },
    {
      value: 'outline',
      tooltip: 'Outline',
      label: 'Outline'
    }
  ];

  public readonly touchModeOptions: readonly ExclusiveButtonOption<'draw' | 'pan'>[] = [
    {
      value: 'draw',
      tooltip: 'Draw',
      label: 'Draw'
    },
    {
      value: 'pan',
      tooltip: 'Pan',
      label: 'Pan'
    }
  ];

  private static readonly prefsKey = 'golt-simfs';

  private downloadFrameRangeTouched = false;

  private nextEditableTribeKey = 0;

  private nextEditableRuleKey = 0;

  private expandedRuleKeyBeforeDrag: string | null = null;

  private readonly mobileLayoutQuery: MediaQueryList | null = null;

  private transitionResetFrame: number | null = null;

  private transitionResetCleanupFrame: number | null = null;

  private readonly mobileLayoutListenerController = new AbortController();

  public get generationCounter(): number {
    return this.metrics?.generation ?? 0;
  }

  public get packingButtonOptions(): readonly ExclusiveButtonOption<BitsPerCell>[] {
    return this.simulationPackingOptions.map(bitsPerCell => ({
      value: bitsPerCell,
      title: `${bitsPerCell} bits per cell`,
      label: `${bitsPerCell}`,
      disabled: this.isBitPackingDisabled(bitsPerCell)
    }));
  }

  public get selectedTouchMode(): 'draw' | 'pan' {
    return this.panMode ? 'pan' : 'draw';
  }

  public get runTooltip(): string {
    switch (true) {
      case this.runDisabled: return 'Busy';
      case this.canPause: return 'Pause the simulation';
      default: return 'Run the simulation';
    }
  }

  public get stepBackTooltip(): string {
    switch (true) {
      case this.stepBackDisabled: return 'Busy or no recording available';
      case +this.skipAmount > this.generationCounter: return 'Go back to generation #0';
      default: return `Go back to generation #${this.generationCounter - this.skipAmount}`;
    }
  }

  public get stepForwardTooltip(): string {
    if (this.stepForwardDisabled) {
      return 'Busy';
    }
    return `Skip to generation #${+this.skipAmount + this.generationCounter}`;
  }

  public get runDisabled(): boolean {
    return this.downloading || this.rebuilding || (this.backpressure && !this.running && !this.stepping);
  }

  public get canPause(): boolean {
    return this.running || this.stepping;
  }

  public get isBusy(): boolean {
    return this.downloading || this.stepping || this.backpressure || this.rebuilding;
  }

  public get stepBackDisabled(): boolean {
    return this.running || this.isBusy || this.chunksSaving || !this.metrics?.canStepBack;
  }

  public get stepForwardDisabled(): boolean {
    return this.running || this.isBusy;
  }

  public get recordingDisabled(): boolean {
    return this.downloading || !this.recordingAvailable;
  }

  public get downloading(): boolean {
    return this.downloadProgress >= 0;
  }

  public get downloadButtonDisabled(): boolean {
    return this.downloadProgress >= 0 || this.chunksSaving || !!this.downloadFrameRangeError || (!this.downloadCsv && !this.downloadSaves && !this.downloadMp4 && !this.downloadPng);
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

  public get frameSizeTooltip(): string {
    return `${this.formatBytes(RECORDING_MAX_FRAME_BYTES)} recording buget / ${this.formatBytes(this.maxBytes)} total buget`;
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
    return `${this.formatBytesDecimal(this.storagePendingRawBytes)} pending / ${this.formatBytesDecimal(this.storageCompressedBytes)} compressed / ${this.formatBytes(this.storageQuotaBytes)} quota`;
  }

  public get vramTitleSize(): string {
    return this.formatBytes(this.vramSimulationBytes + this.vramRecordingBytes);
  }

  public get vramQuotaFormatted(): string {
    return Number.isFinite(this.vramBudgetBytes) ? this.formatBytes(this.vramBudgetBytes) : 'Detecting…';
  }

  public get vramSimulationFormatted(): string {
    return this.formatBytes(this.vramSimulationBytes);
  }

  public get vramRecordingFormatted(): string {
    return this.formatBytes(this.vramRecordingBytes);
  }

  public get vramSimulationPct(): number {
    return Number.isFinite(this.vramBudgetBytes) && this.vramBudgetBytes > 0 ? (this.vramSimulationBytes / this.vramBudgetBytes) * 100 : 0;
  }

  public get vramRecordingPct(): number {
    return Number.isFinite(this.vramBudgetBytes) && this.vramBudgetBytes > 0 ? (this.vramRecordingBytes / this.vramBudgetBytes) * 100 : 0;
  }

  public get vramBarTooltip(): string {
    return `${this.vramSimulationFormatted} simulation / ${this.vramRecordingFormatted} recording / ${this.vramQuotaFormatted} budget`;
  }

  public get vramBarTotal(): number {
    if (Number.isFinite(this.vramBudgetBytes) && this.vramBudgetBytes > 0) {
      return this.vramBudgetBytes;
    }

    return this.vramSimulationBytes + this.vramRecordingBytes;
  }

  public get vramSegments(): StorageBarSegment[] {
    return [
      {
        label: 'simulation',
        value: this.vramSimulationBytes,
        formatted: this.vramSimulationFormatted,
        color: '#f59e0b'
      },
      {
        label: 'recording',
        value: this.vramRecordingBytes,
        formatted: this.vramRecordingFormatted,
        color: '#e91e8a'
      }
    ];
  }

  public get storageSegments(): StorageBarSegment[] {
    return [
      {
        label: 'pending',
        value: this.storagePendingRawBytes,
        formatted: this.storagePendingFormatted,
        color: '#f59e0b'
      },
      {
        label: 'compressed',
        value: this.storageCompressedBytes,
        formatted: this.storageCompressedFormatted,
        color: '#e91e8a'
      }
    ];
  }

  public get hasUnappliedGridSize(): boolean {
    return +this.pendingCols !== +this.gridCols || +this.pendingRows !== +this.gridRows;
  }

  public get hasInvalidRules(): boolean {
    return this.editRules.some((rule, index) => this.getRuleState(rule, index).invalid);
  }

  public get hasUnappliedPacking(): boolean {
    return +this.pendingSimulationBitsPerCell !== +this.simulationGridFormat.bitsPerCell;
  }

  public get gridColsError(): string | null {
    if (+this.pendingCols < 3) {
      return 'Min 3';
    }
    return null;
  }

  public get gridRowsError(): string | null {
    if (+this.pendingRows < 3) {
      return 'Min 3';
    }
    return null;
  }

  public get recordingGateMessage(): string {
    if (this.recordingAvailable) {
      return 'Recording slows down the simulation.';
    }
    return 'Grid is too large for recording.';
  }

  public get pendingGridOverRecordingFrameLimit(): boolean {
    return this.pendingGridFrameByteSize > RECORDING_MAX_FRAME_BYTES;
  }

  public get pendingGridOverAllowedFrameLimit(): boolean {
    return Number.isFinite(this.maxBytes) && this.pendingGridFrameByteSize > this.maxBytes;
  }

  public get pendingPackingOverRecordingFrameLimit(): boolean {
    return this.pendingPackingFrameByteSize > RECORDING_MAX_FRAME_BYTES;
  }

  public get pendingPackingOverAllowedFrameLimit(): boolean {
    return Number.isFinite(this.maxBytes) && this.pendingPackingFrameByteSize > this.maxBytes;
  }

  public get recordingFrameLimitLabel(): string {
    return `${this.formatBytes(RECORDING_MAX_FRAME_BYTES)} (${RECORDING_MAX_FRAME_BYTES.toLocaleString()} bytes)`;
  }

  public get allowedFrameLimitLabel(): string {
    if (!Number.isFinite(this.maxBytes)) {
      return 'Detecting…';
    }
    return `${this.formatBytes(this.maxBytes)} (${this.maxBytes.toLocaleString()} bytes)`;
  }

  public get mp4GateMessage(): string | null {
    const frames = this.metrics?.totalFrames || 0;
    if (frames === 0) {
      return null;
    }
    const bitrateBps = this.mp4BitrateMbps * 1_000_000;
    const overheadMultiplier = 1.1; // 10% safety margin for muxer overhead
    const estimatedBytes = (frames / this.mp4Fps) * (bitrateBps / 8) * overheadMultiplier;
    const twoGb = 2 * 1024 * 1024 * 1024;
    if (estimatedBytes > twoGb) {
      return `Estimated MP4 size (${this.formatBytes(estimatedBytes)}) exceeds the 2 GB memory limit — MP4 will be skipped. Increase FPS, lower bitrate, or record fewer frames`;
    }
    return null;
  }

  public get brushMaxSize(): number {
    return Math.max(1, Math.floor(Math.min(this.gridCols, this.gridRows) / 4));
  }

  public get totalRecordedFrames(): number {
    return Math.max(0, this.metrics?.totalFrames ?? 0);
  }

  public get hasRecordedFrames(): boolean {
    return this.totalRecordedFrames > 0;
  }

  public get normalizedDownloadFrameRange(): DownloadFrameRange | null {
    if (this.downloadAllFrames || !this.hasRecordedFrames) {
      return null;
    }
    const startFrame = Math.min(Math.max(1, Math.floor(this.downloadStartFrame || 1)), this.totalRecordedFrames);
    const endFrame = Math.min(Math.max(startFrame, Math.floor(this.downloadEndFrame || startFrame)), this.totalRecordedFrames);
    return {
      startFrame,
      endFrame
    };
  }

  public get downloadFrameRangeError(): string | null {
    if (this.downloadAllFrames || !this.hasRecordedFrames) {
      return null;
    }
    if (!Number.isFinite(this.downloadStartFrame) || !Number.isFinite(this.downloadEndFrame)) {
      return 'Frame range must use whole numbers.';
    }
    if (this.downloadStartFrame < 1 || this.downloadEndFrame < 1) {
      return 'Frame range must start at frame 1 or later.';
    }
    if (this.downloadStartFrame > this.totalRecordedFrames || this.downloadEndFrame > this.totalRecordedFrames) {
      return `Recorded frames currently range from 1 to ${this.totalRecordedFrames.toLocaleString()}.`;
    }
    if (this.downloadStartFrame > this.downloadEndFrame) {
      return 'Start frame must be less than or equal to end frame.';
    }
    return null;
  }

  public get pendingPackingFrameByteSize(): number {
    return gridByteSize(this.gridCols, this.gridRows, gridFormatFromBits(this.pendingSimulationBitsPerCell));
  }

  public get pendingGridFrameByteSize(): number {
    return gridByteSize(this.pendingCols, this.pendingRows, gridFormatFromBits(this.simulationGridFormat.bitsPerCell));
  }

  public get pendingGridFrameSizeFormatted(): string {
    return this.formatBytes(this.pendingGridFrameByteSize);
  }

  public get pendingPackingFrameSizeFormatted(): string {
    return this.formatBytes(this.pendingPackingFrameByteSize);
  }

  public constructor(private readonly elRef: ElementRef, private readonly zone: NgZone, private readonly cdr: ChangeDetectorRef) {
    this.loadPrefs();
    if (typeof window !== 'undefined' && 'matchMedia' in window) {
      this.mobileLayoutQuery = window.matchMedia('(max-width: 640px)');
      this.mobileLayoutQuery.addEventListener('change', () => {
        this.zone.run(() => {
          this.handleMobileLayoutChange();
        });
      }, {
        signal: this.mobileLayoutListenerController.signal
      });
    }
  }

  public ngOnDestroy(): void {
    this.mobileLayoutListenerController.abort();
    this.clearPendingTransitionReset();
  }

  public ngOnChanges(changes: SimpleChanges): void {
    if (changes['ruleset'] && this.ruleset) {
      this.syncFromRuleset();
      this.refreshTribesDirtyState();
      this.refreshRulesDirtyState();
    }
    if (changes['gridCols'] || changes['gridRows']) {
      this.pendingCols = this.gridCols;
      this.pendingRows = this.gridRows;
    }
    if (changes['simulationGridFormat']) {
      this.pendingSimulationBitsPerCell = this.simulationGridFormat.bitsPerCell;
    }
    if (changes['metrics']) {
      this.syncDownloadFrameRange();
    }
  }

  public isBitPackingDisabled(bitsPerCell: BitsPerCell): boolean {
    return !validatePackingAgainstStateCount(bitsPerCell, this.ruleset.tribes.length);
  }

  public toggle(): void {
    this.clearPendingTransitionReset();
    this.suppressClosedTransition = false;
    this.collapsed = !this.collapsed;
    if (!this.collapsed) {
      this.sheetTranslate = '0px';
    }
  }

  public emit(action: SidebarEvent['action'], value?: unknown): void {
    this.sidebarEvent.emit({
      action,
      value
    });
  }

  public onTribeChange(id: string): void {
    this.emit('selectTribes', this.toggleTribeSelection(id));
  }

  public onSpeedChange(value: string): void {
    const n = +value;
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
    this.emit('setGridSize', {
      cols: this.pendingCols,
      rows: this.pendingRows
    });
  }

  public onPackingApply(): void {
    this.emit('setPacking', {bitsPerCell: this.pendingSimulationBitsPerCell});
  }

  public onDownload(): void {
    this.emit('download', {
      csv: this.downloadCsv,
      mp4: this.downloadMp4 && !this.mp4GateMessage,
      png: this.downloadPng,
      saves: this.downloadSaves,
      fps: this.mp4Fps,
      bitrate: this.mp4BitrateMbps * 1_000_000,
      frameRange: this.normalizedDownloadFrameRange
    });
  }

  public onDownloadAllFramesChange(checked: boolean): void {
    this.downloadAllFrames = checked;
    this.downloadFrameRangeTouched = false;
    this.syncDownloadFrameRange();
    this.savePrefs();
  }

  public onDownloadStartFrameChange(value: number): void {
    this.downloadStartFrame = value;
    this.downloadFrameRangeTouched = true;
  }

  public onDownloadEndFrameChange(value: number): void {
    this.downloadEndFrame = value;
    this.downloadFrameRangeTouched = true;
  }

  public onStepBack(): void {
    this.emit('stepBack', +this.skipAmount);
  }

  public onStepForward(): void {
    this.emit('stepForward', +this.skipAmount);
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

  public onTouchModeChange(mode: 'draw' | 'pan'): void {
    if ((mode === 'pan') !== this.panMode) {
      this.emit('togglePanMode');
    }
  }

  public onPackingOptionChange(bitsPerCell: BitsPerCell): void {
    this.pendingSimulationBitsPerCell = bitsPerCell;
  }

  public onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (reader.result instanceof ArrayBuffer) {
        this.emit('loadState', reader.result);
      }
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

  public saveTribe(event: TribeSaveEvent): void {
    if (event.kind === 'add') {
      this.editTribes.push({
        id: event.tribe.id,
        color: event.tribe.color,
        key: this.createEditableTribeKey()
      });
      this.showTribeAdder = false;
      this.refreshTribesDirtyState();
      return;
    }

    const index = this.findEditTribeIndexByKey(event.key);
    if (index < 0) {
      return;
    }

    const oldId = this.editTribes[index]!.id;
    this.editTribes[index] = {
      ...this.editTribes[index]!,
      id: event.tribe.id,
      color: event.tribe.color
    };
    if (oldId !== event.tribe.id) {
      for (const rule of this.editRules) {
        if (rule.tribe === oldId) {
          rule.tribe = event.tribe.id;
        }
        this.renameTribeInClause(rule.clause, oldId, event.tribe.id);
      }
    }
    this.refreshTribesDirtyState();
    this.refreshRulesDirtyState();
  }

  public cancelAddTribe(): void {
    this.showTribeAdder = false;
  }

  public removeTribe(key: string): void {
    const index = this.findEditTribeIndexByKey(key);
    if (index < 0) {
      return;
    }

    const {id} = (this.editTribes[index]!);
    if (id === DEAD_TRIBE_ID) {
      return;
    }
    this.editTribes.splice(index, 1);
    this.editRules = this.editRules.filter(r => {
      this.removeTribeIdFromClause(r.clause, id);
      return r.tribe !== id;
    });
    this.refreshTribesDirtyState();
    this.refreshRulesDirtyState();
  }

  public addRule(): void {
    const dt = this.defaultTribeId();
    const newRule = {
      key: this.createEditableRuleKey(),
      muted: false,
      clause: EMPTY_CLAUSE,
      tribe: dt
    };
    this.editRules.push(newRule);
    this.ruleStatesByKey.set(this.ruleStateKey(newRule, this.editRules.length - 1), {
      dirty: true,
      invalid: true
    });
    this.expandedRuleIndex = this.editRules.length - 1;
    this.refreshRulesDirtyState();
  }

  public removeRule(index: number): void {
    const removedRule = this.editRules[index];
    this.editRules.splice(index, 1);
    if (removedRule) {
      this.ruleStatesByKey.delete(this.ruleStateKey(removedRule, index));
    }
    this.pruneRuleStates();
    if (this.expandedRuleIndex === index) {
      this.expandedRuleIndex = null;
    } else if (this.expandedRuleIndex !== null && this.expandedRuleIndex > index) {
      this.expandedRuleIndex--;
    }
    this.refreshRulesDirtyState();
  }

  public duplicateRule(index: number): void {
    const rule = this.editRules[index];
    if (!rule) {
      return;
    }
    const clonedRule = structuredClone(rule);
    clonedRule.key = this.createEditableRuleKey();
    clonedRule.muted = !!clonedRule.muted;
    this.editRules.splice(index + 1, 0, clonedRule);
    this.ruleStatesByKey.set(this.ruleStateKey(clonedRule, index + 1), {
      dirty: true,
      invalid: true
    });
    if (this.expandedRuleIndex !== null && this.expandedRuleIndex > index) {
      this.expandedRuleIndex++;
    }
    this.expandedRuleIndex = index + 1;
    this.refreshRulesDirtyState();
  }

  public onRuleDragStarted(index: number): void {
    this.draggingRuleIndex = index;
    this.beginRuleDragSession();
  }

  public onRuleDragHandlePointerDown(index: number): void {
    this.draggingRuleIndex = index;
    this.beginRuleDragSession();
  }

  public onRuleDragEnded(): void {
    this.draggingRuleIndex = null;
  }

  public onRuleDropped(event: CdkDragDrop<Rule<Tribe[]>[]>): void {
    if (event.previousIndex !== event.currentIndex) {
      moveItemInArray(this.editRules, event.previousIndex, event.currentIndex);
      this.pruneRuleStates();
      this.refreshRulesDirtyState();
    }

    this.draggingRuleIndex = null;
    this.restoreExpandedRuleAfterReorder();
  }

  public baselineRule(index: number): Rule<Tribe[]> | null {
    return this.ruleset.rules[index] ?? null;
  }

  public toggleRuleExpand(index: number): void {
    this.expandedRuleIndex = this.expandedRuleIndex === index ? null : index;
  }

  public onRuleChanged(event: RuleChangeEvent): void {
    const currentRule = this.editRules[event.index];
    if (!currentRule) {
      return;
    }

    this.editRules[event.index] = {
      ...event.rule,
      key: currentRule.key
    };
    this.ruleStatesByKey.set(this.ruleStateKey(this.editRules[event.index]!, event.index), {
      dirty: event.dirty,
      invalid: event.invalid
    });
    this.pruneRuleStates();
    this.refreshRulesDirtyState();
  }

  public onRuleStateChanged(event: RuleStateChangeEvent): void {
    const rule = this.editRules[event.index];
    if (!rule) {
      return;
    }

    this.ruleStatesByKey.set(this.ruleStateKey(rule, event.index), {
      dirty: event.dirty,
      invalid: event.invalid
    });
    this.refreshRulesDirtyState();
  }

  public applyTribes(): void {
    if (this.hasInvalidRules) {
      return;
    }

    this.emit('updateRuleset', {
      tribes: this.editTribes.map(t => this.toTribe(t)),
      rules: this.editRules.map(rule => this.toPersistedRule(rule)),
      cols: this.ruleset.cols,
      rows: this.ruleset.rows
    });
    this.hasUnappliedTribes = false;
  }

  public restoreTribes(): void {
    this.editTribes = this.ruleset.tribes.map(t => this.toEditableTribe(t));
    this.showTribeAdder = false;
    this.refreshTribesDirtyState();
    this.refreshRulesDirtyState();
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
    if (this.hasInvalidRules) {
      return;
    }

    this.emit('updateRuleset', {
      tribes: this.editTribes.map(t => this.toTribe(t)),
      rules: this.editRules.map(rule => this.toPersistedRule(rule)),
      cols: this.ruleset.cols,
      rows: this.ruleset.rows
    });
    this.hasUnappliedRules = false;
  }

  public restoreRules(): void {
    const previousExpandedRuleKey = this.expandedRuleIndex !== null ? this.editRules[this.expandedRuleIndex]?.key ?? null : null;
    const previousRuleKeyBuckets = this.buildRuleKeyBuckets(this.editRules);
    this.editRules = this.ruleset.rules.map(rule => {
      const signature = this.ruleSignature(rule);
      const keyBucket = previousRuleKeyBuckets.get(signature);
      const preferredKey = keyBucket && keyBucket.length > 0 ? keyBucket.shift() : undefined;
      return this.toEditableRule(rule, preferredKey);
    });
    this.ruleStatesByKey.clear();
    if (previousExpandedRuleKey) {
      const expandedRuleIndex = this.editRules.findIndex(rule => rule.key === previousExpandedRuleKey);
      this.expandedRuleIndex = expandedRuleIndex >= 0 ? expandedRuleIndex : null;
    } else {
      this.expandedRuleIndex = null;
    }
    this.refreshRulesDirtyState();
  }

  public restoreGridSize(): void {
    this.pendingCols = this.gridCols;
    this.pendingRows = this.gridRows;
  }

  public restorePacking(): void {
    this.pendingSimulationBitsPerCell = this.simulationGridFormat.bitsPerCell;
  }

  public onSheetDragStart(event: PointerEvent): void {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }

    event.preventDefault();

    const startY = event.clientY;
    const panel = this.elRef.nativeElement.querySelector('.sidebar-panel') as HTMLElement;
    const handle = event.currentTarget as HTMLElement | null;
    const panelHeight = panel.offsetHeight;
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    const currentTranslateY = panel.getBoundingClientRect().bottom - viewportHeight;

    panel.classList.add('dragging');
    document.body.style.userSelect = 'none';
    handle?.setPointerCapture?.(event.pointerId);

    const cleanup = () => {
      panel.classList.remove('dragging');
      document.body.style.userSelect = '';
      handle?.releasePointerCapture?.(event.pointerId);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onEnd);
      document.removeEventListener('pointercancel', onEnd);
    };

    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== event.pointerId) {
        return;
      }

      e.preventDefault();
      const dy = e.clientY - startY;
      const newTranslate = Math.max(0, currentTranslateY + dy);
      this.sheetTranslate = `${newTranslate}px`;
      this.cdr.detectChanges();
    };

    const onEnd = (e: PointerEvent) => {
      if (e.pointerId !== event.pointerId) {
        return;
      }

      const dy = e.clientY - startY;
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
      cleanup();
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onEnd);
    document.addEventListener('pointercancel', onEnd);
  }

  public onResizeStart(event: PointerEvent): void {
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    document.body.style.userSelect = 'none';
    const startX = event.clientX;
    const startWidth = this.sidebarWidth;
    const handle = event.currentTarget as HTMLElement | null;
    const panel = this.elRef.nativeElement.querySelector('.sidebar-panel') as HTMLElement | null;

    handle?.setPointerCapture?.(event.pointerId);
    panel?.classList.add('resizing');

    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== event.pointerId) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      this.sidebarWidth = Math.max(300, Math.min(600, startWidth + e.clientX - startX));
      this.cdr.detectChanges();
    };

    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== event.pointerId) {
        return;
      }

      e.preventDefault();
      e.stopPropagation();
      document.body.style.userSelect = '';
      panel?.classList.remove('resizing');
      handle?.releasePointerCapture?.(event.pointerId);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      document.removeEventListener('pointercancel', onUp);
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    document.addEventListener('pointercancel', onUp);
  }

  public toggleSection(section: 'presets' | 'packing' | 'tribes' | 'rules' | 'metrics' | 'shortcuts' | 'mp4Settings' | 'downloadSelection'): void {
    switch (section) {
      case 'presets': this.presetsExpanded = !this.presetsExpanded; break;
      case 'packing': this.packingExpanded = !this.packingExpanded; break;
      case 'tribes': this.tribesExpanded = !this.tribesExpanded; break;
      case 'rules': this.rulesExpanded = !this.rulesExpanded; break;
      case 'metrics': this.metricsExpanded = !this.metricsExpanded; break;
      case 'shortcuts': this.shortcutsExpanded = !this.shortcutsExpanded; break;
      case 'mp4Settings': this.mp4SettingsExpanded = !this.mp4SettingsExpanded; break;
      case 'downloadSelection': this.downloadSelectionExpanded = !this.downloadSelectionExpanded; break;
    }
    this.savePrefs();
  }

  public onSectionExpandedChange(section: 'presets' | 'packing' | 'tribes' | 'rules' | 'metrics' | 'shortcuts', expanded: boolean): void {
    switch (section) {
      case 'presets': this.presetsExpanded = expanded; break;
      case 'packing': this.packingExpanded = expanded; break;
      case 'tribes': this.tribesExpanded = expanded; break;
      case 'rules': this.rulesExpanded = expanded; break;
      case 'metrics': this.metricsExpanded = expanded; break;
      case 'shortcuts': this.shortcutsExpanded = expanded; break;
    }
    this.savePrefs();
  }

  public savePrefs(): void {
    try {
      const existing = JSON.parse(localStorage.getItem(Sidebar.prefsKey) ?? '{}');
      localStorage.setItem(Sidebar.prefsKey, JSON.stringify({
        ...existing,
        shortcutsExpanded: this.shortcutsExpanded,
        presetsExpanded: this.presetsExpanded,
        packingExpanded: this.packingExpanded,
        tribesExpanded: this.tribesExpanded,
        rulesExpanded: this.rulesExpanded,
        metricsExpanded: this.metricsExpanded,
        downloadCsv: this.downloadCsv,
        downloadSaves: this.downloadSaves,
        downloadMp4: this.downloadMp4,
        downloadPng: this.downloadPng,
        downloadAllFrames: this.downloadAllFrames,
        mp4Fps: this.mp4Fps,
        mp4BitrateMbps: this.mp4BitrateMbps,
        mp4SettingsExpanded: this.mp4SettingsExpanded,
        downloadSelectionExpanded: this.downloadSelectionExpanded,
        skipAmount: +this.skipAmount
      }));
    } catch (e) {
      console.warn('Failed to save sidebar preferences:', e);
    }
  }

  private handleMobileLayoutChange(): void {
    if (!this.collapsed) {
      return;
    }
    this.suppressClosedTransition = true;
    this.cdr.markForCheck();
    this.clearPendingTransitionReset();
    this.transitionResetFrame = requestAnimationFrame(() => {
      this.transitionResetFrame = null;
      this.transitionResetCleanupFrame = requestAnimationFrame(() => {
        this.transitionResetCleanupFrame = null;
        this.suppressClosedTransition = false;
        this.cdr.markForCheck();
      });
    });
  }

  private clearPendingTransitionReset(): void {
    if (this.transitionResetFrame !== null) {
      cancelAnimationFrame(this.transitionResetFrame);
      this.transitionResetFrame = null;
    }
    if (this.transitionResetCleanupFrame !== null) {
      cancelAnimationFrame(this.transitionResetCleanupFrame);
      this.transitionResetCleanupFrame = null;
    }
  }

  private toggleTribeSelection(id: string): string[] {
    if (id === DEAD_TRIBE_ID) {
      return [DEAD_TRIBE_ID];
    }
    // If currently in delete mode (only DEAD_TRIBE_ID selected), start fresh.
    if (this.drawTribes.length === 1 && this.drawTribes[0] === DEAD_TRIBE_ID) {
      return [id];
    }
    const current = this.drawTribes.filter(t => t !== DEAD_TRIBE_ID);
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
    this.editTribes = this.ruleset.tribes.map(t => this.toEditableTribe(t));
    this.editRules = this.ruleset.rules.map(rule => this.toEditableRule(rule));
    this.ruleStatesByKey.clear();
    this.pendingCols = this.ruleset.cols;
    this.pendingRows = this.ruleset.rows;
  }

  private toEditableTribe(tribe: Tribe): EditableTribe {
    return {
      ...tribe,
      key: this.createEditableTribeKey()
    };
  }

  private toEditableRule(rule: Rule<Tribe[]>, preferredKey?: string): Rule<Tribe[]> {
    const editableRule = structuredClone(rule);
    editableRule.clause = this.normalizeClauseForEditor(editableRule.clause);
    editableRule.key = preferredKey ?? this.createEditableRuleKey();
    editableRule.muted = !!editableRule.muted;
    return editableRule;
  }

  private toPersistedRule(rule: Rule<Tribe[]>): Rule<Tribe[]> {
    const persistedRule = structuredClone(rule);
    persistedRule.clause = this.normalizeClauseForEditor(persistedRule.clause);
    delete persistedRule.key;
    persistedRule.muted = !!persistedRule.muted;
    return persistedRule;
  }

  private normalizeClauseForEditor(clause: Clause<Tribe[]>): Clause<Tribe[]> {
    switch (clause.kind) {
      case EMPTY_CLAUSE_KIND:
        return EMPTY_CLAUSE;
      case COMPARISON_CLAUSE_KIND:
        return {
          ...clause,
          margin: clause.margin ?? 0
        };
      case NOT_CLAUSE_KIND:
        return {
          ...clause,
          clause: this.normalizeClauseForEditor(clause.clause)
        };
      case AND_CLAUSE_KIND:
      case OR_CLAUSE_KIND:
      case XOR_CLAUSE_KIND: {
        const normalizedClauses = clause.clauses.map(sub => this.normalizeClauseForEditor(sub));
        while (normalizedClauses.length < 2) {
          normalizedClauses.push(EMPTY_CLAUSE);
        }
        return {
          ...clause,
          clauses: normalizedClauses as [Clause<Tribe[]>, Clause<Tribe[]>, ...Clause<Tribe[]>[]]
        };
      }
      default:
        return clause;
    }
  }

  private restoreExpandedRuleAfterReorder(): void {
    if (!this.expandedRuleKeyBeforeDrag) {
      return;
    }

    const expandedIndex = this.editRules.findIndex(rule => rule.key === this.expandedRuleKeyBeforeDrag);
    this.expandedRuleIndex = expandedIndex >= 0 ? expandedIndex : null;
    this.expandedRuleKeyBeforeDrag = null;
  }

  private beginRuleDragSession(): void {
    if (this.expandedRuleIndex === null) {
      return;
    }

    const expandedRule = this.editRules[this.expandedRuleIndex];
    this.expandedRuleKeyBeforeDrag = expandedRule?.key ?? null;
    this.expandedRuleIndex = null;
    this.cdr.detectChanges();
  }

  private findEditTribeIndexByKey(key: string): number {
    return this.editTribes.findIndex(tribe => tribe.key === key);
  }

  private toTribe(tribe: EditableTribe): Tribe {
    return {
      id: tribe.id,
      color: tribe.color
    };
  }

  private createEditableTribeKey(): string {
    const key = `editable-tribe-${this.nextEditableTribeKey}`;
    this.nextEditableTribeKey++;
    return key;
  }

  private createEditableRuleKey(): string {
    const key = `editable-rule-${this.nextEditableRuleKey}`;
    this.nextEditableRuleKey++;
    return key;
  }

  private defaultTribeId(): string {
    return this.editTribes.find(t => t.id !== DEAD_TRIBE_ID)?.id ?? DEAD_TRIBE_ID;
  }

  private refreshTribesDirtyState(): void {
    if (!this.ruleset) {
      return;
    }
    this.hasUnappliedTribes = !this.tribesEqual(this.editTribes, this.ruleset.tribes);
  }

  private refreshRulesDirtyState(): void {
    if (!this.ruleset) {
      return;
    }
    this.pruneRuleStates();
    const countChanged = this.editRules.length !== this.ruleset.rules.length;
    const anyDirty = this.editRules.some((rule, index) => this.getRuleState(rule, index).dirty);
    this.hasUnappliedRules = countChanged || anyDirty;
  }

  private tribesEqual(editableTribes: readonly EditableTribe[], baseTribes: readonly Tribe[]): boolean {
    if (editableTribes.length !== baseTribes.length) {
      return false;
    }

    return editableTribes.every((tribe, index) => {
      const base = baseTribes[index];
      return base ? tribe.id === base.id && tribe.color === base.color : false;
    });
  }

  private ruleStateKey(rule: Rule<Tribe[]>, index: number): string {
    return rule.key ?? `rule-${index}`;
  }

  private ruleSignature(rule: Rule<Tribe[]>): string {
    return JSON.stringify(this.toPersistedRule(rule));
  }

  private buildRuleKeyBuckets(rules: readonly Rule<Tribe[]>[]): Map<string, string[]> {
    const ruleKeyBuckets = new Map<string, string[]>();
    for (const rule of rules) {
      const signature = this.ruleSignature(rule);
      const {key} = rule;
      if (!key) {
        continue;
      }

      const existingKeys = ruleKeyBuckets.get(signature);
      if (existingKeys) {
        existingKeys.push(key);
      } else {
        ruleKeyBuckets.set(signature, [key]);
      }
    }
    return ruleKeyBuckets;
  }

  private getRuleState(rule: Rule<Tribe[]>, index: number): {dirty: boolean; invalid: boolean} {
    return this.ruleStatesByKey.get(this.ruleStateKey(rule, index)) ?? {
      dirty: true,
      invalid: true
    };
  }

  private pruneRuleStates(): void {
    const activeKeys = new Set(this.editRules.map((rule, index) => this.ruleStateKey(rule, index)));
    for (const key of this.ruleStatesByKey.keys()) {
      if (!activeKeys.has(key)) {
        this.ruleStatesByKey.delete(key);
      }
    }
  }

  private syncDownloadFrameRange(): void {
    const totalFrames = this.totalRecordedFrames;
    if (totalFrames <= 0) {
      this.downloadStartFrame = 1;
      this.downloadEndFrame = 1;
      return;
    }

    if (this.downloadAllFrames) {
      this.downloadStartFrame = 1;
      this.downloadEndFrame = totalFrames;
      return;
    }

    if (!this.downloadFrameRangeTouched) {
      this.downloadStartFrame = 1;
      this.downloadEndFrame = totalFrames;
      return;
    }

    this.downloadStartFrame = Math.min(Math.max(1, Math.floor(this.downloadStartFrame || 1)), totalFrames);
    this.downloadEndFrame = Math.min(Math.max(this.downloadStartFrame, Math.floor(this.downloadEndFrame || this.downloadStartFrame)), totalFrames);
  }

  private removeTribeIdFromClause(clause: Clause<Tribe[]>, tribeId: string): void {
    if (clause.kind === EMPTY_CLAUSE_KIND) {
      return;
    }
    if (clause.kind === IS_CLAUSE_KIND || clause.kind === COUNT_CLAUSE_KIND || clause.kind === NONE_CLAUSE_KIND || clause.kind === EXACTLY_CLAUSE_KIND || clause.kind === MIN_CLAUSE_KIND || clause.kind === MAX_CLAUSE_KIND) {
      const idx = clause.tribes.indexOf(tribeId);
      if (idx >= 0 && clause.tribes.length > 1) {
        clause.tribes.splice(idx, 1);
      }
    } else if (clause.kind === COMPARISON_CLAUSE_KIND) {
      const idx1 = clause.tribe1.indexOf(tribeId);
      if (idx1 >= 0 && clause.tribe1.length > 1) {
        clause.tribe1.splice(idx1, 1);
      }
      const idx2 = clause.tribe2.indexOf(tribeId);
      if (idx2 >= 0 && clause.tribe2.length > 1) {
        clause.tribe2.splice(idx2, 1);
      }
    } else if (clause.kind === NOT_CLAUSE_KIND) {
      this.removeTribeIdFromClause(clause.clause, tribeId);
    } else if (clause.kind === AND_CLAUSE_KIND || clause.kind === OR_CLAUSE_KIND || clause.kind === XOR_CLAUSE_KIND) {
      for (const child of clause.clauses) {
        this.removeTribeIdFromClause(child, tribeId);
      }
    }
  }

  private renameTribeInClause(clause: Clause<Tribe[]>, oldId: string, newId: string): void {
    if (clause.kind === EMPTY_CLAUSE_KIND) {
      return;
    }
    if (clause.kind === IS_CLAUSE_KIND || clause.kind === COUNT_CLAUSE_KIND || clause.kind === NONE_CLAUSE_KIND || clause.kind === EXACTLY_CLAUSE_KIND || clause.kind === MIN_CLAUSE_KIND || clause.kind === MAX_CLAUSE_KIND) {
      const idx = clause.tribes.indexOf(oldId);
      if (idx >= 0) {
        clause.tribes[idx] = newId;
      }
    } else if (clause.kind === COMPARISON_CLAUSE_KIND) {
      const idx1 = clause.tribe1.indexOf(oldId);
      if (idx1 >= 0) {
        clause.tribe1[idx1] = newId;
      }
      const idx2 = clause.tribe2.indexOf(oldId);
      if (idx2 >= 0) {
        clause.tribe2[idx2] = newId;
      }
    } else if (clause.kind === NOT_CLAUSE_KIND) {
      this.renameTribeInClause(clause.clause, oldId, newId);
    } else if (clause.kind === AND_CLAUSE_KIND || clause.kind === OR_CLAUSE_KIND || clause.kind === XOR_CLAUSE_KIND) {
      for (const child of clause.clauses) {
        this.renameTribeInClause(child, oldId, newId);
      }
    }
  }

  private loadPrefs(): void {
    try {
      const raw = localStorage.getItem(Sidebar.prefsKey);
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
      if (typeof p.packingExpanded === 'boolean') {
        this.packingExpanded = p.packingExpanded;
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
      if (typeof p.downloadAllFrames === 'boolean') {
        this.downloadAllFrames = p.downloadAllFrames;
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
      if (typeof p.downloadSelectionExpanded === 'boolean') {
        this.downloadSelectionExpanded = p.downloadSelectionExpanded;
      }
      if (typeof p.skipAmount === 'number' && p.skipAmount >= 1) {
        this.skipAmount = p.skipAmount;
      }
    } catch (e) {
      console.warn('Failed to load sidebar preferences:', e);
    }
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
      return `${(bytes / 1024).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })} KB`;
    }
    if (bytes < 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024)).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })} MB`;
    }
    if (bytes < 1024 * 1024 * 1024 * 1024) {
      return `${(bytes / (1024 * 1024 * 1024)).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })} GB`;
    }
    return `${(bytes / (1024 * 1024 * 1024 * 1024)).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })} TB`;
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
      return `${(bytes / 1000).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })} KB`;
    }
    if (bytes < 1_000_000_000) {
      return `${(bytes / 1_000_000).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })} MB`;
    }
    if (bytes < 1_000_000_000_000) {
      return `${(bytes / 1_000_000_000).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })} GB`;
    }
    return `${(bytes / 1_000_000_000_000).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })} TB`;
  }
}

export type {SidebarEvent};
