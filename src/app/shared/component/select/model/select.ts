/**
 * Select value type.
 *
 * @export
 * @typedef {SelectValue}
 */
export type SelectValue = string | number | null;

/**
 * Select option.
 *
 * @export
 * @interface SelectOption
 * @typedef {SelectOption}
 */
export interface SelectOption {
  /**
   * Value.
   *
   * @type {SelectValue}
   */
  value: SelectValue;
  /**
   * Display label.
   *
   * @type {string}
   */
  label: string;
  /**
   * Whether the option is disabled.
   *
   * @type {?boolean}
   */
  disabled?: boolean;
  /**
   * Whether the option is hidden.
   *
   * @type {?boolean}
   */
  hidden?: boolean;
  /**
   * Optional tribe swatch color in RGB hex (no #) used for rich option rendering.
   *
   * @type {?string}
   */
  swatchColor?: string;
}
