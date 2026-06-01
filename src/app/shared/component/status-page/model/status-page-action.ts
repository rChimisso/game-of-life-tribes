/**
 * Base data for a button in the status page.
 *
 * @interface StatusActionBase
 * @typedef {StatusActionBase}
 */
interface StatusActionBase {
  /**
   * Action ID.
   *
   * @type {string}
   */
  id: string;
  /**
   * Action icon, from Material Icons.
   *
   * @type {string}
   */
  icon: string;
  /**
   * Action label.
   *
   * @type {string}
   */
  label: string;
}

/**
 * Status page button action that routes to another page.
 *
 * @interface StatusRouteAction
 * @typedef {StatusRouteAction}
 * @extends {StatusActionBase}
 */
interface StatusRouteAction extends StatusActionBase {
  /**
   * Route to navigate to when the button is clicked.
   *
   * @type {string}
   */
  route: string;
}

/**
 * Status page button action that executes a callback.
 *
 * @interface StatusCallbackAction
 * @typedef {StatusCallbackAction}
 * @extends {StatusActionBase}
 */
interface StatusCallbackAction extends StatusActionBase {
  /**
   * Callback to execute when the button is clicked.
   *
   * @type {() => void}
   */
  execute: () => void;
}

/**
 * Status page button action.
 *
 * @interface StatusAction
 * @typedef {StatusAction}
 */
export type StatusAction = StatusRouteAction | StatusCallbackAction;
