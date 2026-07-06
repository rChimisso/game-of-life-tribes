/**
 * Numeric input constraints.
 *
 * @interface NumberInputConstraints
 * @typedef {NumberInputConstraints}
 */
export interface NumberInputConstraints {
  /**
   * Minimum numeric value.
   *
   * @type {(number | undefined)}
   */
  min?: number;
  /**
   * Maximum numeric value.
   *
   * @type {(number | undefined)}
   */
  max?: number;
  /**
   * Maximum accepted decimal places.
   *
   * @type {number}
   */
  decimalDigits: number;
  /**
   * Decimal places to preserve in the formatted view.
   *
   * @type {(number | undefined)}
   */
  fixedDecimalDigits?: number;
  /**
   * Minimum integer digits.
   *
   * @type {(number | undefined)}
   */
  minIntegerDigits?: number;
  /**
   * Maximum integer digits.
   *
   * @type {(number | undefined)}
   */
  maxIntegerDigits?: number;
  /**
   * View decimal separator.
   *
   * @type {'.' | ','}
   */
  decimalSeparator: '.' | ',';
}

/**
 * Numeric edit result.
 *
 * @interface NumberInputEditResult
 * @typedef {NumberInputEditResult}
 */
export interface NumberInputEditResult {
  /**
   * Whether the edited value is structurally accepted.
   *
   * @type {boolean}
   */
  accepted: boolean;
  /**
   * Normalized view value.
   *
   * @type {string}
   */
  viewValue: string;
  /**
   * Parsed model value.
   *
   * @type {(number | null)}
   */
  modelValue: number | null;
}

/**
 * Numeric validation metadata.
 *
 * @interface NumberInputValidation
 * @typedef {NumberInputValidation}
 */
export interface NumberInputValidation {
  /**
   * Decimal digit count.
   *
   * @type {number}
   */
  decimalDigits: number;
  /**
   * Integer digit count.
   *
   * @type {number}
   */
  integerDigits: number;
}
