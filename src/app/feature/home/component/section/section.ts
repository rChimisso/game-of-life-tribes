import {ChangeDetectionStrategy, Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
import {MatIconModule} from '@angular/material/icon';

import {HomeSectionPreferences} from '../../model/preferences';

import {PreferencesStore} from '~gol/core/service/preferences-store';

/**
 * Home sidebar section.
 *
 * @class HomeSection
 * @typedef {HomeSection}
 * @implements {OnInit}
 */
@Component({
  selector: 'gol-home-section',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './section.html',
  styleUrl: './section.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomeSection implements OnInit {
  /**
   * Section title.
   *
   * @public
   * @type {string}
   */
  @Input({required: true})
  public header = '';

  /**
   * Section description.
   *
   * @public
   * @type {string}
   */
  @Input({required: true})
  public description = '';

  /**
   * Optional section info for additional data in the title space.
   *
   * @public
   * @type {string}
   */
  @Input()
  public info = '';

  /**
   * Whether the section is collapsible.
   *
   * @public
   * @type {boolean}
   */
  @Input()
  public collapsible = true;

  /**
   * Whether the section is expanded.
   *
   * @public
   * @type {boolean}
   */
  @Input()
  public expanded = true;

  /**
   * Local storage key for persisted expansion state.
   *
   * @public
   * @type {string}
   */
  @Input()
  public preferenceKey = '';

  /**
   * Emitter for the expanded state change event.
   *
   * @public
   * @readonly
   * @type {EventEmitter<boolean>}
   */
  @Output()
  public readonly expandedChange = new EventEmitter<boolean>();

  /**
   * Default preferences.
   *
   * @private
   * @readonly
   * @type {HomeSectionPreferences}
   */
  private readonly defaultPreferences: HomeSectionPreferences = {
    expanded: true
  };

  /**
   * Creates the home section.
   *
   * @public
   * @constructor
   * @param {PreferencesStore} preferencesStore preference storage.
   */
  public constructor(private readonly preferencesStore: PreferencesStore) {}

  /**
   * @inheritdoc
   */
  public ngOnInit(): void {
    if (this.preferenceKey) {
      this.restorePreferences();
    }
  }

  /**
   * Handles the header click event.
   *
   * @public
   */
  public onHeaderClick(): void {
    if (this.collapsible) {
      this.expanded = !this.expanded;
      this.savePreferences();
      this.expandedChange.emit(this.expanded);
    }
  }

  /**
   * Collects current preferences.
   *
   * @private
   * @returns {HomeSectionPreferences}
   */
  private collectPreferences(): HomeSectionPreferences {
    return {
      expanded: this.expanded
    };
  }

  /**
   * Applies restored preferences.
   *
   * @private
   * @param {HomeSectionPreferences} preferences
   */
  private applyPreferences(preferences: HomeSectionPreferences): void {
    this.expanded = preferences.expanded;
  }

  /**
   * Restores preferences from storage.
   *
   * @private
   */
  private restorePreferences(): void {
    this.applyPreferences(this.preferencesStore.load(this.preferenceKey, this.defaultPreferences, (stored, defaults) => ({
      ...defaults,
      ...stored
    })));
  }

  /**
   * Saves current preferences.
   *
   * @private
   */
  private savePreferences(): void {
    this.preferencesStore.save(this.preferenceKey, this.collectPreferences());
  }
}
