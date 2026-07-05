/**
 * Baseline equality callback.
 *
 * @typedef {BaselineEquality}
 * @template T
 */
export type BaselineEquality<T> = (baseline: T, current: T) => boolean;

/**
 * Baseline state for apply/restore editors.
 *
 * @class BaselineState
 * @typedef {BaselineState}
 * @template T
 */
export class BaselineState<T> {
  /**
   * Baseline value.
   *
   * @private
   * @type {T}
   */
  private baseline: T;

  /**
   * Creates baseline state.
   *
   * @public
   * @constructor
   * @param {T} value initial baseline value.
   */
  public constructor(value: T) {
    this.baseline = this.cloneValue(value);
  }

  /**
   * Sets the baseline value.
   *
   * @public
   * @param {T} value baseline value.
   */
  public set(value: T): void {
    this.baseline = this.cloneValue(value);
  }

  /**
   * Gets a cloned baseline value.
   *
   * @public
   * @returns {T} baseline value.
   */
  public value(): T {
    return this.clone();
  }

  /**
   * Checks whether a value differs from the baseline.
   *
   * @public
   * @param {T} current current value.
   * @param {BaselineEquality<T>} [equals=this.equals] equality callback.
   * @returns {boolean} whether current value differs.
   */
  public hasChanges(current: T, equals: BaselineEquality<T> = this.equals): boolean {
    return !equals(this.baseline, current);
  }

  /**
   * Clones the baseline value.
   *
   * @public
   * @returns {T} cloned baseline value.
   */
  public clone(): T {
    return this.cloneValue(this.baseline);
  }

  /**
   * Compares plain structured values.
   *
   * @private
   * @param {T} baseline baseline value.
   * @param {T} current current value.
   * @returns {boolean} whether values are equal.
   */
  private equals(baseline: T, current: T): boolean {
    return JSON.stringify(baseline) === JSON.stringify(current);
  }

  /**
   * Clones a plain structured value.
   *
   * @private
   * @param {T} value value to clone.
   * @returns {T} cloned value.
   */
  private cloneValue(value: T): T {
    return structuredClone(value);
  }
}
