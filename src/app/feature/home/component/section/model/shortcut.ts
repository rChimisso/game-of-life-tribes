/**
 * Shortcut display value.
 *
 * @export
 * @interface ShortcutValue
 * @typedef {ShortcutValue}
 */
export interface ShortcutValue {
  /**
   * Shortcut code shown in the code label.
   *
   * @type {string}
   */
  code: string;
  /**
   * Shortcut label.
   *
   * @type {string}
   */
  label: string;
  /**
   * Optional shortcut tooltip.
   *
   * @type {string}
   */
  tooltip?: string;
}

/**
 * Shortcut group.
 *
 * @export
 * @interface ShortcutGroup
 * @typedef {ShortcutGroup}
 */
export interface ShortcutGroup {
  /**
   * Group title.
   *
   * @type {string}
   */
  title: string;
  /**
   * Group shortcuts.
   *
   * @type {ShortcutValue[]}
   */
  values: ShortcutValue[];
}
