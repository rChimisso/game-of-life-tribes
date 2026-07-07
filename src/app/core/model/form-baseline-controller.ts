import {AbstractControl} from '@angular/forms';

import {BaselineEquality, BaselineState} from './baseline-state';
import {resetControlInteractionState} from '../function/form-control';

/**
 * Coordinates a form/editor with a semantic baseline.
 *
 * @class FormBaselineController
 * @typedef {FormBaselineController}
 * @template T
 */
export class FormBaselineController<T> {
  /**
   * Baseline storage.
   *
   * @private
   * @readonly
   * @type {BaselineState<T>}
   */
  private readonly baseline: BaselineState<T>;

  /**
   * Creates a form baseline controller.
   *
   * @public
   * @constructor
   * @param {T} initialValue initial baseline value.
   * @param {AbstractControl} control control whose interaction state is reset.
   * @param {() => T} read current editor value reader.
   * @param {(value: T) => void} write editor value writer.
   * @param {BaselineEquality<T>} equals semantic equality callback.
   */
  public constructor(
    initialValue: T,
    private readonly control: AbstractControl,
    private readonly read: () => T,
    private readonly write: (value: T) => void,
    private readonly equals: BaselineEquality<T>
  ) {
    this.baseline = new BaselineState<T>(initialValue);
  }

  /**
   * Checks whether the current editor value differs from baseline.
   *
   * @public
   * @returns {boolean} whether current editor has changes.
   */
  public hasChanges(): boolean {
    return this.baseline.hasChanges(this.read(), this.equals);
  }

  /**
   * Gets a cloned baseline value.
   *
   * @public
   * @returns {T} baseline value.
   */
  public baselineValue(): T {
    return this.baseline.value();
  }

  /**
   * Sets baseline state without writing the editor.
   *
   * @public
   * @param {T} value baseline value.
   */
  public setBaseline(value: T): void {
    this.baseline.set(value);
  }

  /**
   * Syncs a committed value into baseline and editor state.
   *
   * @public
   * @param {T} value committed value.
   */
  public syncCommitted(value: T): void {
    this.setBaseline(value);
    this.write(value);
    resetControlInteractionState(this.control);
  }

  /**
   * Commits the current editor value into baseline state.
   *
   * @public
   */
  public commitCurrent(): void {
    this.setBaseline(this.read());
    resetControlInteractionState(this.control);
  }

  /**
   * Restores the editor from baseline state.
   *
   * @public
   */
  public restore(): void {
    this.write(this.baselineValue());
    resetControlInteractionState(this.control);
  }
}
