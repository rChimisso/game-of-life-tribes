/**
 * Callback plumbing for compound control value accessors.
 *
 * @class CvaController
 * @typedef {CvaController}
 * @template T
 */
export class CvaController<T> {
  /**
   * Registers the CVA change callback.
   *
   * @public
   * @param {(value: T) => void} fn change callback.
   */
  public registerOnChange(fn: (value: T) => void): void {
    this.onChange = fn;
  }

  /**
   * Registers the CVA touched callback.
   *
   * @public
   * @param {() => void} fn touched callback.
   */
  public registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  /**
   * Registers the Angular validator-change callback.
   *
   * @public
   * @param {() => void} fn validator-change callback.
   */
  public registerOnValidatorChange(fn: () => void): void {
    this.onValidatorChange = fn;
  }

  /**
   * Emits a CVA value change.
   *
   * @public
   * @param {T} value value to emit.
   */
  public emitChange(value: T): void {
    this.onChange(value);
  }

  /**
   * Emits a CVA touched notification.
   *
   * @public
   */
  public emitTouched(): void {
    this.onTouched();
  }

  /**
   * Emits an Angular validator-change notification.
   *
   * @public
   */
  public emitValidatorChange(): void {
    this.onValidatorChange();
  }

  /**
   * CVA change callback.
   *
   * @private
   * @type {(value: T) => void}
   */
  private onChange: (value: T) => void = () => undefined;

  /**
   * CVA touched callback.
   *
   * @private
   * @type {() => void}
   */
  private onTouched: () => void = () => undefined;

  /**
   * Validator change callback.
   *
   * @private
   * @type {() => void}
   */
  private onValidatorChange: () => void = () => undefined;
}
