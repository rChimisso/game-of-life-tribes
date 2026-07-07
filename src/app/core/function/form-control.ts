import {AbstractControl} from '@angular/forms';
import {Observable, filter} from 'rxjs';

import {ControlErrorResolver} from '../model/control-error';

/**
 * Sets a control disabled state without emitting value changes.
 *
 * @param {AbstractControl} control control to update.
 * @param {boolean} disabled whether the control should be disabled.
 */
export function setControlDisabled(control: AbstractControl, disabled: boolean): void {
  if (disabled !== control.disabled) {
    if (disabled) {
      control.disable({emitEvent: false});
    } else {
      control.enable({emitEvent: false});
    }
  }
}

/**
 * Resets pristine and touched interaction state for a control.
 *
 * @param {AbstractControl} control control to reset.
 */
export function resetControlInteractionState(control: AbstractControl): void {
  control.markAsPristine();
  control.markAsUntouched();
}

/**
 * Emits changed control values only when the value is non-null and valid.
 *
 * @param {AbstractControl<T | null>} control control to observe.
 * @returns {Observable<T>} valid non-null values.
 * @template T
 */
export function validControlValues<T>(control: AbstractControl<T | null>): Observable<T> {
  return control.valueChanges.pipe(
    filter((value): value is T => value !== null && control.valid)
  );
}

/**
 * Resolves the first matching control error in caller-supplied priority order.
 *
 * @param {AbstractControl} control control to inspect.
 * @param {readonly ControlErrorResolver[]} resolvers ordered error resolvers.
 * @returns {(string | null)} first matching message.
 */
export function firstControlError(control: AbstractControl, resolvers: readonly ControlErrorResolver[]): string | null {
  let message: string | null = null;
  for (const [errorName, resolver] of resolvers) {
    if (message === null && control.hasError(errorName)) {
      const error = control.getError(errorName) as unknown;
      message = typeof resolver === 'string' ? resolver : resolver(error);
    }
  }
  return message;
}

/**
 * Reads a numeric validation limit from an Angular validation error.
 *
 * @param {unknown} error validation error metadata.
 * @param {'min' | 'max'} key limit key.
 * @param {number} fallback fallback limit.
 * @returns {number} resolved limit.
 */
export function numericErrorLimit(error: unknown, key: 'min' | 'max', fallback: number): number {
  let limit = fallback;
  if (typeof error === 'object' && error !== null && key in error) {
    const value = (error as Record<'min' | 'max', unknown>)[key];
    if (typeof value === 'number') {
      limit = value;
    }
  }
  return limit;
}
