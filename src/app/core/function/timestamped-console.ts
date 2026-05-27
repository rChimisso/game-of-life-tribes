/**
 * Global marker set after the console methods have been wrapped.
 *
 * @type {string}
 */
const TIMESTAMPED_CONSOLE_MARKER = 'goltTimestampedConsoleInstalled';

/**
 * Console levels that receive timestamps.
 *
 * @typedef {TimestampedConsoleLevel}
 */
type TimestampedConsoleLevel = 'log' | 'warn' | 'error';

/**
 * Global object augmented with the console timestamp marker.
 *
 * @interface TimestampedConsoleGlobal
 * @typedef {TimestampedConsoleGlobal}
 */
interface TimestampedConsoleGlobal {
  /**
   * Whether timestamped console wrapping has already been installed.
   *
   * @type {boolean}
   */
  goltTimestampedConsoleInstalled?: boolean;
}

/**
 * Installs timestamp prefixes for console log, warning, and error messages.
 *
 * @export
 */
function installTimestampedConsole(): void {
  const consoleGlobal = globalThis as typeof globalThis & TimestampedConsoleGlobal;
  if (!consoleGlobal[TIMESTAMPED_CONSOLE_MARKER]) {
    consoleGlobal[TIMESTAMPED_CONSOLE_MARKER] = true;
    wrapConsoleLevel('log');
    wrapConsoleLevel('warn');
    wrapConsoleLevel('error');
  }
}

/**
 * Wraps one console level with an ISO timestamp prefix.
 *
 * @param {TimestampedConsoleLevel} level console level.
 */
function wrapConsoleLevel(level: TimestampedConsoleLevel): void {
  const original = console[level].bind(console);
  console[level] = (...data: Parameters<Console[TimestampedConsoleLevel]>): void => {
    original(`[${new Date().toISOString()}]`, ...data);
  };
}

installTimestampedConsole();

export {installTimestampedConsole};
