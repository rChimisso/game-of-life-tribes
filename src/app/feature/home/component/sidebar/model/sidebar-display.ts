/**
 * VRAM display input values.
 *
 * @interface SidebarVramDisplayInput
 * @typedef {SidebarVramDisplayInput}
 */
export interface SidebarVramDisplayInput {
  /**
   * VRAM budget in bytes.
   *
   * @type {number}
   */
  budgetBytes: number;
  /**
   * Simulation VRAM bytes.
   *
   * @type {number}
   */
  simulationBytes: number;
  /**
   * Recording VRAM bytes.
   *
   * @type {number}
   */
  recordingBytes: number;
}

/**
 * Recording storage display input values.
 *
 * @interface SidebarStorageDisplayInput
 * @typedef {SidebarStorageDisplayInput}
 */
export interface SidebarStorageDisplayInput {
  /**
   * Pending raw bytes.
   *
   * @type {number}
   */
  pendingRawBytes: number;
  /**
   * Compressed bytes.
   *
   * @type {number}
   */
  compressedBytes: number;
  /**
   * Reserved bytes.
   *
   * @type {number}
   */
  reservedBytes: number;
  /**
   * Storage quota bytes.
   *
   * @type {number}
   */
  quotaBytes: number;
}

/**
 * Sidebar grid display input values.
 *
 * @interface SidebarGridDisplayInput
 * @typedef {SidebarGridDisplayInput}
 */
export interface SidebarGridDisplayInput {
  /**
   * Grid columns.
   *
   * @type {number}
   */
  cols: number;
  /**
   * Grid rows.
   *
   * @type {number}
   */
  rows: number;
}
