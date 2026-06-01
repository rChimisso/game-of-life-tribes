import {ChangeDetectionStrategy, Component, EventEmitter, Input, OnInit, Output} from '@angular/core';
import {MatIconModule} from '@angular/material/icon';

import {PersistedPreferencesComponent} from '../../../../core/abstract/persisted-preferences-component';
import {HomeSectionPreferences} from '../../model/preferences';

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
export class HomeSection extends PersistedPreferencesComponent<HomeSectionPreferences> implements OnInit {
  /**
   * Section title.
   *
   * @public
   * @type {string}
   */
  @Input({required: true})
  public title = '';

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
   * @protected
   * @readonly
   * @type {HomeSectionPreferences}
   */
  protected override readonly defaultPreferences: HomeSectionPreferences = {
    expanded: true
  };

  /**
   * Creates the home section.
   *
   * @public
   * @constructor
   */
  public constructor() {
    super('');
  }

  /**
   * @inheritdoc
   */
  public ngOnInit(): void {
    if (this.preferenceKey) {
      this.setStorageKey(this.preferenceKey);
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
   * @protected
   * @returns {HomeSectionPreferences}
   */
  protected override collectPreferences(): HomeSectionPreferences {
    return {
      expanded: this.expanded
    };
  }

  /**
   * Applies restored preferences.
   *
   * @protected
   * @param {HomeSectionPreferences} preferences
   */
  protected override applyPreferences(preferences: HomeSectionPreferences): void {
    this.expanded = preferences.expanded;
  }
}
