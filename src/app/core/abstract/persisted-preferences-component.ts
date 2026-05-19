import {Directive} from '@angular/core';

/**
 * Abstract persisted preferences component.
 *
 * @export
 * @abstract
 * @class PersistedPreferencesComponent
 * @typedef {PersistedPreferencesComponent}
 * @template {object} T
 */
@Directive()
export abstract class PersistedPreferencesComponent<T extends object> {
  /**
   * Persisted local storage key.
   *
   * @private
   * @type {string}
   */
  private storageKey: string;

  /**
   * Default preferences.
   *
   * @protected
   * @readonly
   * @type {T}
   */
  protected abstract readonly defaultPreferences: T;

  /**
   * Creates the persisted preferences component.
   *
   * @protected
   * @constructor
   * @param {string} preferenceKey
   */
  protected constructor(preferenceKey: string) {
    this.storageKey = preferenceKey;
  }

  /**
   * Sets the local storage key.
   *
   * @protected
   * @param {string} preferenceKey
   */
  protected setPreferenceKey(preferenceKey: string): void {
    this.storageKey = preferenceKey;
  }

  /**
   * Restores preferences from storage.
   *
   * @protected
   */
  protected restorePreferences(): void {
    this.applyPreferences(this.loadPreferences());
  }

  /**
   * Loads preferences from storage.
   *
   * @protected
   * @returns {T}
   */
  protected loadPreferences(): T {
    let preferences = this.defaultPreferences;
    if (this.storageKey) {
      try {
        const raw = localStorage.getItem(this.storageKey);
        const parsed = raw ? JSON.parse(raw) : {};
        const stored = this.isPreferenceRecord(parsed) ? parsed as Partial<T> : {};
        preferences = this.normalizePreferences(stored, this.defaultPreferences);
      } catch (e) {
        console.warn(`Failed to load preferences for ${this.storageKey}:`, e);
      }
    }
    return preferences;
  }

  /**
   * Saves current preferences to storage.
   *
   * @protected
   */
  protected savePreferences(): void {
    if (this.storageKey && this.shouldSavePreferences()) {
      try {
        localStorage.setItem(this.storageKey, JSON.stringify(this.collectPreferences()));
      } catch (e) {
        console.warn(`Failed to save preferences for ${this.storageKey}:`, e);
      }
    }
  }

  /**
   * Saves a partial preference update.
   *
   * @protected
   * @param {Partial<T>} patch
   */
  protected savePreferencePatch(patch: Partial<T>): void {
    if (this.storageKey && this.shouldSavePreferences()) {
      try {
        localStorage.setItem(this.storageKey, JSON.stringify({
          ...this.collectPreferences(),
          ...patch
        }));
      } catch (e) {
        console.warn(`Failed to save preferences for ${this.storageKey}:`, e);
      }
    }
  }

  /**
   * Normalizes stored preferences.
   *
   * @protected
   * @param {Partial<T>} stored
   * @param {T} defaults
   * @returns {T}
   */
  protected normalizePreferences(stored: Partial<T>, defaults: T): T {
    return {
      ...defaults,
      ...stored
    };
  }

  /**
   * Whether preferences should be saved.
   *
   * @protected
   * @returns {boolean}
   */
  protected shouldSavePreferences(): boolean {
    return true;
  }

  /**
   * Collects current preferences.
   *
   * @protected
   * @abstract
   * @returns {T}
   */
  protected abstract collectPreferences(): T;

  /**
   * Applies restored preferences.
   *
   * @protected
   * @abstract
   * @param {T} preferences
   */
  protected abstract applyPreferences(preferences: T): void;

  /**
   * Whether a parsed storage value can be treated as an object.
   *
   * @private
   * @param {unknown} value
   * @returns {boolean}
   */
  private isPreferenceRecord(value: unknown): boolean {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
