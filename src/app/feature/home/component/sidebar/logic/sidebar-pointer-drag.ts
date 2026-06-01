import {SidebarPointerDragOptions} from '../model/sidebar-pointer-drag';

/**
 * Checks whether a pointer event can start a sidebar drag interaction.
 *
 * @export
 * @param {PointerEvent} event pointer event.
 * @returns {boolean} true when dragging may start.
 */
export function canStartSidebarPointerDrag(event: PointerEvent): boolean {
  return event.pointerType !== 'mouse' || event.button === 0;
}

/**
 * Starts a sidebar pointer drag and wires shared cleanup.
 *
 * @export
 * @param {SidebarPointerDragOptions} options drag options.
 */
export function startSidebarPointerDrag(options: SidebarPointerDragOptions): void {
  const {event} = options;
  if (canStartSidebarPointerDrag(event)) {
    event.preventDefault();
    if (options.stopPropagation) {
      event.stopPropagation();
    }
    document.body.style.userSelect = 'none';
    options.handle?.setPointerCapture?.(event.pointerId);
    if (options.className) {
      options.classTarget?.classList.add(options.className);
    }
    const cleanup = () => {
      document.body.style.userSelect = '';
      if (options.className) {
        options.classTarget?.classList.remove(options.className);
      }
      options.handle?.releasePointerCapture?.(event.pointerId);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onEnd);
      document.removeEventListener('pointercancel', onEnd);
      options.onCleanup?.();
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerId === event.pointerId) {
        e.preventDefault();
        if (options.stopPropagation) {
          e.stopPropagation();
        }
        options.onMove(e);
      }
    };
    const onEnd = (e: PointerEvent) => {
      if (e.pointerId === event.pointerId) {
        e.preventDefault();
        if (options.stopPropagation) {
          e.stopPropagation();
        }
        options.onEnd(e);
        cleanup();
      }
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onEnd);
    document.addEventListener('pointercancel', onEnd);
  }
}
