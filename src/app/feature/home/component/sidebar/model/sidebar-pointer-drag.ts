/**
 * Pointer drag options shared by sidebar drag interactions.
 *
 * @export
 * @interface SidebarPointerDragOptions
 * @typedef {SidebarPointerDragOptions}
 */
export interface SidebarPointerDragOptions {
  /**
   * Original pointer event.
   *
   * @type {PointerEvent}
   */
  event: PointerEvent;
  /**
   * Element that owns pointer capture.
   *
   * @type {(HTMLElement | null)}
   */
  handle: HTMLElement | null;
  /**
   * Element decorated during the drag.
   *
   * @type {(HTMLElement | null | undefined)}
   */
  classTarget?: HTMLElement | null;
  /**
   * Class added during the drag.
   *
   * @type {(string | undefined)}
   */
  className?: string;
  /**
   * Whether pointer events should stop propagation.
   *
   * @type {boolean}
   */
  stopPropagation: boolean;
  /**
   * Move callback for matching pointer events.
   *
   * @type {(event: PointerEvent) => void}
   */
  onMove: (event: PointerEvent) => void;
  /**
   * End callback for matching pointer events.
   *
   * @type {(event: PointerEvent) => void}
   */
  onEnd: (event: PointerEvent) => void;
  /**
   * Cleanup callback after listener removal.
   *
   * @type {(() => void) | undefined}
   */
  onCleanup?: () => void;
}
