/**
 * Button data for ExclusiveButtonGroup.
 *
 * @interface ExclusiveButtonOption
 * @typedef {ExclusiveButtonOption}
 * @template T
 */
export interface ExclusiveButtonOption<T> {
  /**
   * Button value.
   *
   * @type {T}
   */
  value: T;
  /**
   * Button label.
   *
   * @type {?string}
   */
  label?: string;
  /**
   * Button tooltip.
   *
   * @type {?string}
   */
  tooltip?: string;
  /**
   * Button icon.
   *
   * @type {?string}
   */
  icon?: string;
  /**
   * Icon style.
   *
   * @type {?Record<string, string>}
   */
  iconStyle?: Record<string, string>;
  /**
   * Whether the button is disabled.
   *
   * @type {?boolean}
   */
  disabled?: boolean;
}
