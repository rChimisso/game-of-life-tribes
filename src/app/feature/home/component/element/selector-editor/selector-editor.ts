import {ChangeDetectionStrategy, Component, EventEmitter, Input, OnChanges, Output} from '@angular/core';
import {FormsModule} from '@angular/forms';

import {SelectorChangeEvent, SelectorStateChangeEvent} from '../model/selector-event';

import {TypedChanges} from '~gol/core/model/typed-change';
import {normalizeSelector, selectorSignature} from '~gol/feature/home/logic/rule-editor';
import {Tribe, TribeSelector} from '~gol/feature/home/model/rule';
import {SelectOption, SelectValue} from '~gol/shared/component/select/model/select';
import {SelectComponent} from '~gol/shared/component/select/select';
import {TribeSwatch} from '~gol/shared/component/tribe-swatch/tribe-swatch';

/**
 * Selector kind editable in the selector editor.
 *
 * @typedef {TribeSelectorKind}
 */
export type TribeSelectorKind = TribeSelector<Tribe[]>['kind'];

/**
 * Editor for tribe selector expressions.
 *
 * @class SelectorEditor
 * @typedef {SelectorEditor}
 * @implements {OnChanges}
 */
@Component({
  selector: 'gol-selector-editor',
  standalone: true,
  imports: [FormsModule, SelectComponent, TribeSwatch],
  templateUrl: './selector-editor.html',
  styleUrl: './selector-editor.scss',
  preserveWhitespaces: false,
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SelectorEditor implements OnChanges {
  /**
   * Editable selector.
   *
   * @public
   * @type {!TribeSelector<Tribe[]>}
   */
  @Input({required: true})
  public selector!: TribeSelector<Tribe[]>;

  /**
   * Baseline selector used for dirty-state checks.
   *
   * @public
   * @type {(TribeSelector<Tribe[]> | null)}
   */
  @Input()
  public baselineSelector: TribeSelector<Tribe[]> | null = null;

  /**
   * Available tribes.
   *
   * @public
   * @type {Tribe[]}
   */
  @Input({required: true})
  public tribes: Tribe[] = [];

  /**
   * Whether editing is disabled.
   *
   * @public
   * @type {boolean}
   */
  @Input()
  public disabled = false;

  /**
   * Selector kinds allowed in this editor.
   *
   * @public
   * @type {TribeSelectorKind[]}
   */
  @Input()
  public allowedKinds: TribeSelectorKind[] = ['tribes', 'same', 'different'];

  /**
   * Emits selector edits with derived state.
   *
   * @public
   * @readonly
   * @type {EventEmitter<SelectorChangeEvent>}
   */
  @Output()
  public readonly selectorChange = new EventEmitter<SelectorChangeEvent>();

  /**
   * Emits dirty and invalid state changes.
   *
   * @public
   * @readonly
   * @type {EventEmitter<SelectorStateChangeEvent>}
   */
  @Output()
  public readonly selectorStateChange = new EventEmitter<SelectorStateChangeEvent>();

  /**
   * Human-readable selector mode options.
   *
   * @public
   * @readonly
   * @type {SelectOption[]}
   */
  public get selectorKindOptions(): SelectOption[] {
    return this.allowedKinds.map(kind => ({
      value: kind,
      label: this.selectorKindLabel(kind)
    }));
  }

  /**
   * Selected tribe IDs for the current selector kind.
   *
   * @public
   * @readonly
   * @type {string[]}
   */
  public get selectedTribes(): string[] {
    let selected: string[] = [];
    if (this.selector.kind === 'tribes') {
      selected = [...this.selector.tribes];
    }
    return selected;
  }

  /**
   * Whether the selector differs from its baseline.
   *
   * @public
   * @readonly
   * @type {boolean}
   */
  public get isDirty(): boolean {
    return this.baselineSelector ? selectorSignature(this.selector) !== selectorSignature(this.baselineSelector) : true;
  }

  /**
   * Whether the selector is invalid.
   *
   * @public
   * @readonly
   * @type {boolean}
   */
  public get isInvalid(): boolean {
    return this.selectorInvalidMessage() !== null;
  }

  /**
   * Validation message for the current selector.
   *
   * @public
   * @returns {(string | null)} validation message.
   */
  public selectorInvalidMessage(): string | null {
    const knownIds = new Set(this.tribes.map(tribe => tribe.id));
    let message: string | null = null;
    switch (this.selector.kind) {
      case 'tribes':
        if (this.selector.tribes.length === 0) {
          message = 'Choose at least one tribe.';
        } else if (this.selector.tribes.some(id => !knownIds.has(id))) {
          message = 'Choose only existing tribes.';
        }
        break;
      case 'tiedMajority':
        message = 'Tied majority selectors are only available in majority tie handling.';
        break;
    }
    return message;
  }

  /**
   * @inheritdoc
   */
  public ngOnChanges(changes: TypedChanges<SelectorEditor>): void {
    if (changes.selector || changes.baselineSelector || changes.tribes || changes.allowedKinds) {
      this.selector = normalizeSelector(this.selector);
      this.emitSelectorState();
    }
  }

  /**
   * Sets the selector kind.
   *
   * @public
   * @param {SelectValue} value selected kind.
   */
  public onSetSelectorKind(value: SelectValue): void {
    if (!this.disabled && typeof value === 'string') {
      this.selector = this.createSelector(value as TribeSelectorKind);
      this.emitSelectorChange();
    }
  }

  /**
   * Toggles one explicit selector tribe.
   *
   * @public
   * @param {string} tribeId tribe id to toggle.
   */
  public onToggleTribe(tribeId: string): void {
    if (!this.disabled && this.selector.kind === 'tribes') {
      const selected = new Set(this.selector.tribes);
      if (selected.has(tribeId)) {
        selected.delete(tribeId);
      } else {
        selected.add(tribeId);
      }
      const nextIds = [...selected];
      const fallbackId = this.defaultTribeId();
      this.selector = {
        ...this.selector,
        tribes: (nextIds.length > 0 ? nextIds : [fallbackId]) as [string, ...string[]]
      };
      this.emitSelectorChange();
    }
  }

  /**
   * Whether the given tribe is selected.
   *
   * @public
   * @param {string} tribeId tribe id.
   * @returns {boolean} `true` if selected.
   */
  public isTribeSelected(tribeId: string): boolean {
    return this.selectedTribes.includes(tribeId);
  }

  /**
   * Label for one selector kind.
   *
   * @public
   * @param {TribeSelectorKind} kind selector kind.
   * @returns {string} display label.
   */
  public selectorKindLabel(kind: TribeSelectorKind): string {
    const labels: Record<TribeSelectorKind, string> = {
      tribes: 'Specific tribes',
      same: 'Same',
      different: 'Different',
      tiedMajority: 'Tied majority'
    };
    return labels[kind];
  }

  /**
   * Emits the current selector and derived state.
   *
   * @private
   */
  private emitSelectorChange(): void {
    const dirty = this.isDirty;
    const invalid = this.isInvalid;
    this.selectorChange.emit({
      selector: this.selector,
      dirty,
      invalid
    });
    this.selectorStateChange.emit({
      dirty,
      invalid
    });
  }

  /**
   * Emits the current selector state.
   *
   * @private
   */
  private emitSelectorState(): void {
    this.selectorStateChange.emit({
      dirty: this.isDirty,
      invalid: this.isInvalid
    });
  }

  /**
   * Creates a selector for one mode.
   *
   * @private
   * @param {TribeSelectorKind} kind selector kind.
   * @returns {TribeSelector<Tribe[]>} selector.
   */
  private createSelector(kind: TribeSelectorKind): TribeSelector<Tribe[]> {
    let selector: TribeSelector<Tribe[]>;
    switch (kind) {
      case 'tribes':
        selector = {
          kind,
          tribes: [this.defaultTribeId()]
        };
        break;
      case 'tiedMajority':
        selector = {
          kind,
          source: {
            kind: 'tribes',
            tribes: [this.defaultTribeId()]
          }
        };
        break;
      default:
        selector = {kind};
        break;
    }
    return selector;
  }

  /**
   * Returns the default tribe id.
   *
   * @private
   * @returns {string} default tribe id.
   */
  private defaultTribeId(): string {
    return this.tribes[0]?.id ?? '';
  }
}
