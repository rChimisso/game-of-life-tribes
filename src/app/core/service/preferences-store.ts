import {Injectable} from '@angular/core';

/**
 * Stores persisted preferences in local storage.
 *
 * @class PreferencesStore
 * @typedef {PreferencesStore}
 */
@Injectable({providedIn: 'root'})
export class PreferencesStore {
  /**
   * Loads and normalizes preferences from storage.
   *
   * @public
   * @param {string} storageKey persisted local storage key.
   * @param {T} defaults default preferences.
   * @param {(stored: Partial<T>, defaults: T) => T} normalize normalizer.
   * @returns {T} loaded preferences.
   * @template {object} T
   */
  public load<T extends object>(storageKey: string, defaults: T, normalize: (stored: Partial<T>, defaults: T) => T): T {
    let preferences = defaults;
    if (storageKey) {
      try {
        const raw = localStorage.getItem(storageKey);
        const parsed = raw ? JSON.parse(raw) as unknown : {};
        const stored = this.isPreferenceRecord(parsed) ? parsed as Partial<T> : {};
        preferences = normalize(stored, defaults);
      } catch (e) {
        console.warn(`Failed to load preferences for ${storageKey}:`, e);
      }
    }
    return preferences;
  }

  /**
   * Saves preferences to storage.
   *
   * @public
   * @param {string} storageKey persisted local storage key.
   * @param {T} preferences preferences to save.
   * @template {object} T
   */
  public save<T extends object>(storageKey: string, preferences: T): void {
    if (storageKey) {
      try {
        localStorage.setItem(storageKey, JSON.stringify(preferences));
      } catch (e) {
        console.warn(`Failed to save preferences for ${storageKey}:`, e);
      }
    }
  }

  /**
   * Saves a top-level preference patch merged over current preferences.
   *
   * @public
   * @param {string} storageKey persisted local storage key.
   * @param {T} currentPreferences current preferences.
   * @param {Partial<T>} patch preference patch.
   * @template {object} T
   */
  public savePatch<T extends object>(storageKey: string, currentPreferences: T, patch: Partial<T>): void {
    this.save(storageKey, {
      ...currentPreferences,
      ...patch
    });
  }

  /**
   * Whether a parsed storage value can be treated as an object.
   *
   * @private
   * @param {unknown} value parsed storage value.
   * @returns {boolean} whether value is a preference record.
   */
  private isPreferenceRecord(value: unknown): boolean {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
}
