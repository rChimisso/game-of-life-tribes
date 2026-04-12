/* eslint-disable jsdoc/require-jsdoc */
import {DecimalPipe, KeyValuePipe, NgTemplateOutlet} from '@angular/common';
import {ChangeDetectorRef, Component, ChangeDetectionStrategy, Input, Output, EventEmitter, OnChanges, SimpleChanges, ElementRef, NgZone} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {MatButtonModule} from '@angular/material/button';
import {MatCheckboxModule} from '@angular/material/checkbox';
import {MatExpansionModule} from '@angular/material/expansion';
import {MatIconModule} from '@angular/material/icon';

import {Clause, NeighborCount, Rule, Ruleset, Tribe} from '../../model/rule';
import {MetricMessage} from '../../worker/webengine';

export interface SidebarEvent {
  action:
    | 'toggleRun'
    | 'restart'
    | 'selectTribe'
    | 'setSpeed'
    | 'setMaxSpeed'
    | 'setGridSize'
    | 'download'
    | 'saveState'
    | 'loadState'
    | 'deleteMode'
    | 'updateRuleset';
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
    DecimalPipe,
    KeyValuePipe
  ],
  templateUrl: './sidebar.html',
  styleUrl: './sidebar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(contextmenu)': '$event.preventDefault()'
  }
})
export class Sidebar implements OnChanges {
  private resizing = false;

  constructor(private readonly elRef: ElementRef, private readonly zone: NgZone, private readonly cdr: ChangeDetectorRef) {}

  @Input() tribes: readonly Tribe[] = [];

  @Input() drawTribe = '';

  @Input() speed = 10;

  @Input() maxSpeed = false;

  @Input() running = false;

  @Input() gridCols = 100;

  @Input() gridRows = 100;

  @Input() metrics: MetricMessage | null = null;

  @Input() deleteMode = false;

  @Input() ruleset!: Ruleset;

  @Output() sidebarEvent = new EventEmitter<SidebarEvent>();

  collapsed = true;

  pendingCols = 100;

  pendingRows = 100;

  downloadCsv = true;

  downloadJson = true;

  downloadFrames = true;

  downloadMp4 = false;

  downloadPng = false;

  mp4Fps = 12;

  // Sidebar resize
  sidebarWidth = 280;

  // Shortcuts
  shortcutsExpanded = false;

  // Tribe editing
  editTribes: Tribe[] = [];

  showTribeAdder = false;

  newTribeId = '';

  newTribeColor = '';

  editingTribeIndex: number | null = null;

  editingTribeName: string | null = null;

  // Rule editing
  editRules: Rule<Tribe[]>[] = [];

  expandedRuleIndex: number | null = null;

  hasUnappliedChanges = false;

  readonly basicColors = [
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

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['ruleset'] && this.ruleset) {
      this.syncFromRuleset();
      this.hasUnappliedChanges = false;
    }
    if (changes['gridCols'] || changes['gridRows']) {
      this.pendingCols = this.gridCols;
      this.pendingRows = this.gridRows;
    }
  }

  private syncFromRuleset(): void {
    this.editTribes = this.ruleset.tribes.map(t => ({...t}));
    this.editRules = structuredClone(this.ruleset.rules);
    this.pendingCols = this.ruleset.cols;
    this.pendingRows = this.ruleset.rows;
  }

  toggle(): void {
    this.collapsed = !this.collapsed;
  }

  emit(action: SidebarEvent['action'], value?: unknown): void {
    this.sidebarEvent.emit({action,
      value});
  }

  onTribeChange(id: string): void {
    this.emit('selectTribe', id);
  }

  onSpeedChange(value: string): void {
    const n = parseInt(value, 10);
    if (n > 0) {
      this.emit('setSpeed', n);
    }
  }

  onMaxSpeedChange(checked: boolean): void {
    this.emit('setMaxSpeed', checked);
  }

  onGridSizeApply(): void {
    this.emit('setGridSize', {cols: this.pendingCols,
      rows: this.pendingRows});
  }

  onDownload(): void {
    this.emit('download', {
      csv: this.downloadCsv,
      json: this.downloadJson,
      frames: this.downloadFrames,
      mp4: this.downloadMp4,
      png: this.downloadPng,
      fps: this.mp4Fps
    });
  }

  onFileSelect(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      this.emit('loadState', reader.result as string);
      input.value = '';
    };
    reader.readAsText(file);
  }

  // ── Tribe editing ──

  startAddTribe(): void {
    this.showTribeAdder = true;
    this.newTribeId = '';
    this.newTribeColor = this.randomColor();
  }

  randomColor(): string {
    return Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
  }

  isValidNewTribe(): boolean {
    if (!this.newTribeId || !this.newTribeColor || this.newTribeColor.length !== 6) {
      return false;
    }
    const id = this.newTribeId.toLowerCase().replace(/[^a-z0-9]/g, '');
    return id.length > 0 && !this.editTribes.some(t => t.id === id);
  }

  confirmAddTribe(): void {
    const id = this.newTribeId.toLowerCase().replace(/[^a-z0-9]/g, '');
    this.editTribes.push({id,
      color: this.newTribeColor});
    this.showTribeAdder = false;
    this.hasUnappliedChanges = true;
  }

  removeTribe(index: number): void {
    const {id} = (this.editTribes[index]!);
    if (id === 'dead') {
      return;
    }
    this.editTribes.splice(index, 1);
    this.editRules = this.editRules.filter(r => {
      this.removeTribeIdFromClause(r.clause, id);
      return r.tribe !== id;
    });
    this.hasUnappliedChanges = true;
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

  startEditTribe(index: number): void {
    if (this.editingTribeIndex === index) {
      this.editingTribeIndex = null;
      this.editingTribeName = null;
    } else {
      this.editingTribeIndex = index;
      this.editingTribeName = this.editTribes[index]!.id;
    }
  }

  updateTribeName(index: number, newName: string): void {
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
    this.hasUnappliedChanges = true;
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

  updateTribeColor(index: number, color: string): void {
    const c = color.toLowerCase().replace(/[^0-9a-f]/g, '');
    if (c.length === 6) {
      this.editTribes[index] = {...this.editTribes[index]!,
        color: c};
      this.hasUnappliedChanges = true;
    }
  }

  // ── Rule editing ──

  addRule(): void {
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
    this.hasUnappliedChanges = true;
  }

  removeRule(index: number): void {
    this.editRules.splice(index, 1);
    if (this.expandedRuleIndex === index) {
      this.expandedRuleIndex = null;
    } else if (this.expandedRuleIndex !== null && this.expandedRuleIndex > index) {
      this.expandedRuleIndex--;
    }
    this.hasUnappliedChanges = true;
  }

  setRuleOutput(index: number, tribe: string): void {
    this.editRules[index] = {...this.editRules[index]!,
      tribe};
    this.hasUnappliedChanges = true;
  }

  toggleRuleExpand(index: number): void {
    this.expandedRuleIndex = this.expandedRuleIndex === index ? null : index;
  }

  // ── Clause editing ──

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

  changeClauseKind(ruleIndex: number, path: number[], newKind: string): void {
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
    this.hasUnappliedChanges = true;
  }

  toggleClauseTribe(ruleIndex: number, path: number[], tribeId: string): void {
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
    this.hasUnappliedChanges = true;
  }

  toggleClauseEqTribe(ruleIndex: number, path: number[], group: 1 | 2, tribeId: string): void {
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
    this.hasUnappliedChanges = true;
  }

  setClauseInterval(ruleIndex: number, path: number[], which: 0 | 1, value: string): void {
    const clause = this.getClauseAtPath(this.editRules[ruleIndex]!.clause, path);
    if (clause.kind !== 'count') {
      return;
    }
    const n = Math.max(0, Math.min(8, parseInt(value, 10) || 0)) as NeighborCount;
    clause.interval[which] = n;
    this.hasUnappliedChanges = true;
  }

  addChildClause(ruleIndex: number, path: number[]): void {
    const clause = this.getClauseAtPath(this.editRules[ruleIndex]!.clause, path);
    if (clause.kind !== 'and' && clause.kind !== 'or') {
      return;
    }
    const dt = this.editTribes.find(t => t.id !== 'dead')?.id ?? 'dead';
    (clause.clauses as Clause<Tribe[]>[]).push({kind: 'is',
      tribes: [dt]});
    this.hasUnappliedChanges = true;
  }

  removeChildClause(ruleIndex: number, path: number[]): void {
    if (path.length === 0) {
      return;
    }
    const parentPath = path.slice(0, -1);
    const childIdx = path[path.length - 1]!;
    const parent = this.getClauseAtPath(this.editRules[ruleIndex]!.clause, parentPath);
    if ((parent.kind === 'and' || parent.kind === 'or') && parent.clauses.length > 2) {
      (parent.clauses as Clause<Tribe[]>[]).splice(childIdx, 1);
      this.hasUnappliedChanges = true;
    }
  }

  applyRulesetChanges(): void {
    this.emit('updateRuleset', {
      tribes: this.editTribes.map(t => ({...t})),
      rules: structuredClone(this.editRules),
      cols: this.ruleset.cols,
      rows: this.ruleset.rows
    });
    this.hasUnappliedChanges = false;
  }

  clauseSummary(clause: Clause<Tribe[]>): string {
    const s = this.clauseStr(clause);
    return s.length > 50 ? `${s.substring(0, 47) }…` : s;
  }

  private clauseStr(clause: Clause<Tribe[]>): string {
    switch (clause.kind) {
      case 'is': return `is ${clause.tribes.join('/')}`;
      case 'count': return `${clause.tribes.join('/')} ∈ [${clause.interval[0]},${clause.interval[1]}]`;
      case 'equality': return `#${clause.tribe1.join('/')} = #${clause.tribe2.join('/')}`;
      case 'not': return `¬(${this.clauseStr(clause.clause)})`;
      case 'and': return clause.clauses.map(c => this.clauseStr(c)).join(' ∧ ');
      case 'or': return clause.clauses.map(c => this.clauseStr(c)).join(' ∨ ');
    }
  }

  getTribeColor(tribeId: string): string {
    return this.editTribes.find(t => t.id === tribeId)?.color ?? '888888';
  }

  // ── Sidebar resize ──

  onResizeStart(event: MouseEvent): void {
    event.preventDefault();
    event.stopPropagation();
    this.resizing = true;
    const startX = event.clientX;
    const startWidth = this.sidebarWidth;

    const onMove = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      this.sidebarWidth = Math.max(220, Math.min(600, startWidth + e.clientX - startX));
      this.cdr.markForCheck();
    };

    const onUp = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      this.resizing = false;
      document.removeEventListener('mousemove', onMove, true);
      document.removeEventListener('mouseup', onUp, true);
    };

    document.addEventListener('mousemove', onMove, true);
    document.addEventListener('mouseup', onUp, true);
  }
}
