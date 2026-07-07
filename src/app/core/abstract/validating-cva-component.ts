import {Directive} from '@angular/core';
import {AbstractControl, ValidationErrors, Validator} from '@angular/forms';

import {CvaComponent} from './cva-component';

/**
 * Atomic control value accessor with Angular validator callback plumbing.
 *
 * @abstract
 * @class ValidatingCvaComponent
 * @typedef {ValidatingCvaComponent}
 * @template T
 * @extends {CvaComponent<T>}
 * @implements {Validator}
 */
@Directive()
export abstract class ValidatingCvaComponent<T> extends CvaComponent<T> implements Validator {
  /**
   * @inheritdoc
   */
  public abstract validate(control: AbstractControl<T>): ValidationErrors | null;

  /**
   * @inheritdoc
   */
  public registerOnValidatorChange(fn: () => void): void {
    this.onValidatorChange = fn;
  }

  /**
   * Emits an Angular validator-change notification.
   *
   * @protected
   */
  protected notifyValidatorChange(): void {
    this.onValidatorChange();
  }

  /**
   * Validator change callback.
   *
   * @private
   * @type {() => void}
   */
  private onValidatorChange: () => void = () => undefined;
}
