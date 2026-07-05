import {FormArray, FormControl, FormGroup} from '@angular/forms';

/**
 * Control type for a form value.
 *
 * @typedef {FormValueControl}
 * @template T
 */
export type FormValueControl<T> = [T] extends [readonly (infer U)[]] ? FormArray<FormValueControl<U>> : [T] extends [object] ? FormGroup<FormType<T>> : FormControl<T>;

/**
 * Form type that transforms value keys into typed controls.
 *
 * @typedef {FormType}
 * @template T
 */
export type FormType<T extends object> = {
  [K in keyof T]: FormValueControl<T[K]>;
};
