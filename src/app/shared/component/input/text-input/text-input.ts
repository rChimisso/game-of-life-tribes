import {ChangeDetectionStrategy, Component, forwardRef, Input, OnChanges} from '@angular/core';
import {AbstractControl, NG_VALIDATORS, NG_VALUE_ACCESSOR, ValidationErrors, Validator} from '@angular/forms';

import {AbstractInputComponent} from '../abstract-input';

import {TypedChanges} from '~gol/core/model/typed-change';

/**
 * Text and color input control.
 *
 * @class TextInputComponent
 * @typedef {TextInputComponent}
 * @extends {AbstractInputComponent<string>}
 * @implements {Validator}
 * @implements {OnChanges}
 */
@Component({
  selector: 'gol-text-input',
  standalone: true,
  templateUrl: './text-input.html',
  styleUrl: './text-input.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => TextInputComponent),
      multi: true
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => TextInputComponent),
      multi: true
    }
  ]
})
export class TextInputComponent extends AbstractInputComponent<string> implements Validator, OnChanges {
  /**
   * Input type.
   *
   * @public
   * @type {'text' | 'color'}
   */
  @Input()
  public type: 'text' | 'color' = 'text';

  /**
   * Allowed full-value pattern.
   *
   * @public
   * @type {(string | RegExp | undefined)}
   */
  @Input()
  public allowedPattern?: string | RegExp;

  /**
   * Minimum text length.
   *
   * @public
   * @type {(number | undefined)}
   */
  @Input()
  public minLength?: number;

  /**
   * Maximum text length.
   *
   * @public
   * @type {(number | undefined)}
   */
  @Input()
  public maxLength?: number;

  /**
   * Current input value.
   *
   * @public
   * @type {string}
   */
  public value = '';

  /**
   * @inheritdoc
   */
  public ngOnChanges(changes: TypedChanges<TextInputComponent>): void {
    if (changes.allowedPattern || changes.minLength || changes.maxLength) {
      this.onValidatorChange();
    }
  }

  /**
   * Handles prospective text insertion.
   *
   * @public
   * @param {InputEvent} event input event.
   */
  public onBeforeInput(event: InputEvent): void {
    const {target} = event;
    if (target instanceof HTMLInputElement && event.data !== null) {
      const start = target.selectionStart ?? target.value.length;
      const end = target.selectionEnd ?? target.value.length;
      const prospectiveValue = `${target.value.slice(0, start)}${event.data}${target.value.slice(end)}`;
      if (!this.isAllowed(prospectiveValue)) {
        event.preventDefault();
      }
    }
  }

  /**
   * Handles input value changes.
   *
   * @public
   * @param {Event} event input event.
   */
  public onInput(event: Event): void {
    const {target} = event;
    if (target instanceof HTMLInputElement) {
      if (this.isAllowed(target.value)) {
        this.setValue(target.value);
      } else {
        target.value = this.value;
      }
    }
  }

  /**
   * @inheritdoc
   */
  public validate(control: AbstractControl<string>): ValidationErrors | null {
    const value = control.value ?? '';
    const errors: ValidationErrors = {};
    if (this.minLength !== undefined && value.length < this.minLength) {
      errors['minlength'] = {
        requiredLength: this.minLength,
        actualLength: value.length
      };
    }
    if (this.maxLength !== undefined && value.length > this.maxLength) {
      errors['maxlength'] = {
        requiredLength: this.maxLength,
        actualLength: value.length
      };
    }
    if (!this.isAllowed(value)) {
      errors['allowedPattern'] = {
        requiredPattern: this.patternLabel(),
        actualValue: value
      };
    }
    return Object.keys(errors).length > 0 ? errors : null;
  }

  /**
   * @inheritdoc
   */
  public registerOnValidatorChange(fn: () => void): void {
    this.onValidatorChange = fn;
  }

  /**
   * @inheritdoc
   */
  protected override normalizeValue(value: string | null): string {
    return value ?? '';
  }

  /**
   * Validator change callback.
   *
   * @private
   * @type {() => void}
   */
  private onValidatorChange: () => void = () => undefined;

  /**
   * Checks whether a full value is allowed.
   *
   * @private
   * @param {string} value value to check.
   * @returns {boolean} whether the value is allowed.
   */
  private isAllowed(value: string): boolean {
    let allowed = true;
    if (this.allowedPattern !== undefined) {
      const pattern = this.pattern();
      allowed = pattern.test(value);
    }
    return allowed;
  }

  /**
   * Builds the current allowed pattern.
   *
   * @private
   * @returns {RegExp} allowed pattern.
   */
  private pattern(): RegExp {
    const pattern = this.allowedPattern;
    let regex: RegExp;
    if (pattern instanceof RegExp) {
      regex = new RegExp(pattern.source, pattern.flags.replace('g', '').replace('y', ''));
    } else {
      regex = new RegExp(pattern ?? '.*');
    }
    return regex;
  }

  /**
   * Returns the current pattern label.
   *
   * @private
   * @returns {string} pattern label.
   */
  private patternLabel(): string {
    return this.allowedPattern instanceof RegExp ? this.allowedPattern.toString() : `${this.allowedPattern}`;
  }
}
