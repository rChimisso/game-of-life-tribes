import {ChangeDetectorRef, Directive, Input} from '@angular/core';
import {ControlValueAccessor} from '@angular/forms';

/**
 * Abstract control value accessor component.
 *
 * @abstract
 * @class CvaComponent
 * @typedef {CvaComponent}
 * @template T
 * @implements {ControlValueAccessor}
 */
@Directive()
export abstract class CvaComponent<T> implements ControlValueAccessor {
  /**
   * Whether it's disabled.
   *
   * @public
   * @type {boolean}
   */
  @Input()
  public disabled = false;

  /**
   * Current value.
   *
   * @public
   * @type {T}
   */
  public abstract value: T;

  /**
   * @constructor
   * @protected
   * @param {ChangeDetectorRef} changeDetectorRef change detector reference.
   */
  public constructor(protected readonly changeDetectorRef: ChangeDetectorRef) {}

  /**
   * @inheritdoc
   */
  public writeValue(value: T | null): void {
    this.value = this.normalizeValue(value);
    this.changeDetectorRef.markForCheck();
  }

  /**
   * @inheritdoc
   */
  public registerOnChange(fn: (value: T) => void): void {
    this.onChange = fn;
  }

  /**
   * @inheritdoc
   */
  public registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  /**
   * @inheritdoc
   */
  public setDisabledState(disabled: boolean): void {
    this.disabled = disabled;
    this.changeDetectorRef.markForCheck();
  }

  /**
   * Handles touch interactions.
   *
   * @public
   */
  public touch(): void {
    this.onTouched();
  }

  /**
   * Sets the value and emits the change callback.
   *
   * @protected
   * @param {T} value
   */
  protected setValue(value: T): void {
    this.value = value;
    this.onChange(this.value);
  }

  /**
   * Normalizes an external form value.
   *
   * @protected
   * @param {(T | null)} value
   * @returns {T}
   */
  protected normalizeValue(value: T | null): T {
    return value as T;
  }

  /**
   * Change callback.
   *
   * @returns {(value: T) => void}
   */
  private onChange: (value: T) => void = () => undefined;

  /**
   * Touch callback.
   *
   * @returns {() => void}
   */
  private onTouched: () => void = () => undefined;
}
