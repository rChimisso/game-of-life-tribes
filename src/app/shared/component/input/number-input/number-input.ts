import {ChangeDetectionStrategy, ChangeDetectorRef, Component, ElementRef, EventEmitter, forwardRef, inject, Input, OnChanges, Output, ViewChild} from '@angular/core';
import {AbstractControl, NG_VALIDATORS, NG_VALUE_ACCESSOR, ValidationErrors, Validator} from '@angular/forms';

import {AbstractInputComponent} from '../abstract-input';
import {formatNumberView, normalizeNumberBlur, normalizeNumberEdit, numberValidationMetadata, prospectiveNumberView, reconcileNumberView} from './logic/number-input';
import {NumberInputConstraints} from './model/number-input';

import {TypedChanges} from '~gol/core/model/typed-change';

/**
 * Numeric input control with separate view and model values.
 *
 * @class NumberInputComponent
 * @typedef {NumberInputComponent}
 * @extends {AbstractInputComponent<number | null>}
 * @implements {Validator}
 * @implements {OnChanges}
 */
@Component({
  selector: 'gol-number-input',
  standalone: true,
  templateUrl: './number-input.html',
  styleUrl: './number-input.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => NumberInputComponent),
      multi: true
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => NumberInputComponent),
      multi: true
    }
  ]
})
export class NumberInputComponent extends AbstractInputComponent<number | null> implements Validator, OnChanges {
  /**
   * Input element.
   *
   * @private
   * @readonly
   * @type {(ElementRef<HTMLInputElement> | undefined)}
   */
  @ViewChild('input')
  private readonly input?: ElementRef<HTMLInputElement>;

  /**
   * Minimum numeric value.
   *
   * @public
   * @type {(number | undefined)}
   */
  @Input()
  public min?: number;

  /**
   * Maximum numeric value.
   *
   * @public
   * @type {(number | undefined)}
   */
  @Input()
  public max?: number;

  /**
   * Maximum decimal digits.
   *
   * @public
   * @type {number}
   */
  @Input()
  public decimalDigits = 0;

  /**
   * Minimum integer digits.
   *
   * @public
   * @type {(number | undefined)}
   */
  @Input()
  public minIntegerDigits?: number;

  /**
   * Maximum integer digits.
   *
   * @public
   * @type {(number | undefined)}
   */
  @Input()
  public maxIntegerDigits?: number;

  /**
   * View decimal separator.
   *
   * @public
   * @type {'.' | ','}
   */
  @Input()
  public decimalSeparator: '.' | ',' = '.';

  /**
   * Emits after the input loses focus.
   *
   * @public
   * @readonly
   * @type {EventEmitter<void>}
   */
  @Output()
  public readonly blurred = new EventEmitter<void>();

  /**
   * Current model value.
   *
   * @public
   * @type {(number | null)}
   */
  public value: number | null = null;

  /**
   * Current view value.
   *
   * @public
   * @type {string}
   */
  public viewValue = '';

  /**
   * Last accepted view value.
   *
   * @private
   * @type {string}
   */
  private lastAcceptedViewValue = '';

  /**
   * Change detector reference.
   *
   * @private
   * @readonly
   * @type {ChangeDetectorRef}
   */
  private readonly numberInputChangeDetectorRef = inject(ChangeDetectorRef);

  /**
   * Browser input mode.
   *
   * @public
   * @readonly
   * @type {'numeric' | 'decimal'}
   */
  public get inputMode(): 'numeric' | 'decimal' {
    return this.normalizedDecimalDigits() === 0 ? 'numeric' : 'decimal';
  }

  /**
   * @inheritdoc
   */
  public ngOnChanges(changes: TypedChanges<NumberInputComponent>): void {
    if (changes.decimalSeparator) {
      this.viewValue = formatNumberView(this.value, this.decimalSeparator);
      this.lastAcceptedViewValue = this.viewValue;
    }
    if (changes.min || changes.decimalDigits || changes.maxIntegerDigits) {
      this.reconcileStructuralView();
    }
    if (changes.min || changes.max || changes.decimalDigits || changes.minIntegerDigits || changes.maxIntegerDigits || changes.decimalSeparator) {
      this.onValidatorChange();
    }
  }

  /**
   * @inheritdoc
   */
  public override writeValue(value: number | null): void {
    this.value = this.normalizeValue(value);
    this.viewValue = formatNumberView(this.value, this.decimalSeparator);
    this.lastAcceptedViewValue = this.viewValue;
    if (this.input) {
      this.input.nativeElement.value = this.viewValue;
    }
    this.numberInputChangeDetectorRef.markForCheck();
  }

  /**
   * Handles prospective value edits.
   *
   * @public
   * @param {InputEvent} event input event.
   */
  public onBeforeInput(event: InputEvent): void {
    const {target} = event;
    if (target instanceof HTMLInputElement && event.data !== null) {
      const start = target.selectionStart ?? target.value.length;
      const end = target.selectionEnd ?? target.value.length;
      const prospectiveValue = prospectiveNumberView(target.value, start, end, event.data);
      const result = normalizeNumberEdit(prospectiveValue, this.constraints());
      if (result.accepted && result.viewValue !== prospectiveValue) {
        event.preventDefault();
        this.acceptViewValue(result.viewValue, result.modelValue, target, this.projectCaretPosition(prospectiveValue, result.viewValue, start + event.data.length));
      } else if (!result.accepted) {
        event.preventDefault();
      }
    }
  }

  /**
   * Handles authoritative input value changes.
   *
   * @public
   * @param {Event} event input event.
   */
  public onInput(event: Event): void {
    const {target} = event;
    if (target instanceof HTMLInputElement) {
      const rawViewValue = target.value;
      const rawCaretPosition = target.selectionStart ?? rawViewValue.length;
      const result = normalizeNumberEdit(target.value, this.constraints());
      if (result.accepted) {
        this.acceptViewValue(result.viewValue, result.modelValue, target, this.projectCaretPosition(rawViewValue, result.viewValue, rawCaretPosition));
      } else {
        target.value = this.lastAcceptedViewValue;
        this.viewValue = this.lastAcceptedViewValue;
        target.setSelectionRange(Math.min(rawCaretPosition, this.lastAcceptedViewValue.length), Math.min(rawCaretPosition, this.lastAcceptedViewValue.length));
      }
    }
  }

  /**
   * Handles input blur.
   *
   * @public
   */
  public onBlur(): void {
    const result = normalizeNumberBlur(this.viewValue, this.constraints());
    if (result.accepted) {
      this.acceptViewValue(result.viewValue, result.modelValue, this.input?.nativeElement ?? null, result.viewValue.length);
    }
    this.touch();
    this.blurred.emit();
  }

  /**
   * @inheritdoc
   */
  public validate(control: AbstractControl<number | null>): ValidationErrors | null {
    const value = control.value ?? null;
    const errors: ValidationErrors = {};
    if (value !== null) {
      const metadata = numberValidationMetadata(value);
      if (this.min !== undefined && value < this.min) {
        errors['min'] = {
          min: this.min,
          actual: value
        };
      }
      if (this.max !== undefined && value > this.max) {
        errors['max'] = {
          max: this.max,
          actual: value
        };
      }
      if (metadata.decimalDigits > this.normalizedDecimalDigits()) {
        errors['decimalDigits'] = {
          max: this.normalizedDecimalDigits(),
          actual: metadata.decimalDigits
        };
      }
      if (this.minIntegerDigits !== undefined && metadata.integerDigits < this.minIntegerDigits) {
        errors['minIntegerDigits'] = {
          min: this.minIntegerDigits,
          actual: metadata.integerDigits
        };
      }
      if (this.maxIntegerDigits !== undefined && metadata.integerDigits > this.maxIntegerDigits) {
        errors['maxIntegerDigits'] = {
          max: this.maxIntegerDigits,
          actual: metadata.integerDigits
        };
      }
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
  protected override normalizeValue(value: number | null): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }

  /**
   * Validator change callback.
   *
   * @private
   * @type {() => void}
   */
  private onValidatorChange: () => void = () => undefined;

  /**
   * Accepts a normalized view value.
   *
   * @private
   * @param {string} viewValue view value.
   * @param {(number | null)} modelValue model value.
   * @param {(HTMLInputElement | null)} input native input.
   * @param {number} caretPosition next caret position.
   */
  private acceptViewValue(viewValue: string, modelValue: number | null, input: HTMLInputElement | null, caretPosition: number): void {
    this.viewValue = viewValue;
    this.lastAcceptedViewValue = viewValue;
    this.setValue(modelValue);
    if (input) {
      input.value = viewValue;
      input.setSelectionRange(caretPosition, caretPosition);
    }
  }

  /**
   * Reconciles the view when dynamic structural constraints change.
   *
   * @private
   */
  private reconcileStructuralView(): void {
    const currentResult = normalizeNumberEdit(this.viewValue, this.constraints());
    if (!currentResult.accepted) {
      const result = reconcileNumberView(this.value, this.constraints());
      this.acceptViewValue(result.viewValue, result.modelValue, this.input?.nativeElement ?? null, result.viewValue.length);
    }
  }

  /**
   * Projects a caret position from a raw view value to a normalized view value.
   *
   * @private
   * @param {string} rawViewValue raw view value.
   * @param {string} normalizedViewValue normalized view value.
   * @param {number} rawCaretPosition raw caret position.
   * @returns {number} normalized caret position.
   */
  private projectCaretPosition(rawViewValue: string, normalizedViewValue: string, rawCaretPosition: number): number {
    const projectedPosition = rawCaretPosition + normalizedViewValue.length - rawViewValue.length;
    return Math.max(0, Math.min(normalizedViewValue.length, projectedPosition));
  }

  /**
   * Builds current numeric constraints.
   *
   * @private
   * @returns {NumberInputConstraints} constraints.
   */
  private constraints(): NumberInputConstraints {
    const constraints: NumberInputConstraints = {
      decimalDigits: this.normalizedDecimalDigits(),
      decimalSeparator: this.decimalSeparator
    };
    if (this.min !== undefined) {
      constraints.min = this.min;
    }
    if (this.max !== undefined) {
      constraints.max = this.max;
    }
    if (this.minIntegerDigits !== undefined) {
      constraints.minIntegerDigits = this.minIntegerDigits;
    }
    if (this.maxIntegerDigits !== undefined) {
      constraints.maxIntegerDigits = this.maxIntegerDigits;
    }
    return constraints;
  }

  /**
   * Normalizes the configured decimal digit count.
   *
   * @private
   * @returns {number} normalized decimal digit count.
   */
  private normalizedDecimalDigits(): number {
    return Math.max(0, Math.trunc(Number(this.decimalDigits) || 0));
  }
}
