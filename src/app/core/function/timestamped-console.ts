import {SeverityLevel} from '../model/severity-level';

/**
 * Global marker set after the console methods have been wrapped.
 *
 * @type {string}
 */
const TIMESTAMPED_CONSOLE_MARKER = 'goltTimestampedConsoleInstalled';

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
 * Installs timestamp prefixes for console info, warning, and error messages.
 */
function installTimestampedConsole(): void {
  const consoleGlobal = globalThis as typeof globalThis & TimestampedConsoleGlobal;
  if (!consoleGlobal[TIMESTAMPED_CONSOLE_MARKER]) {
    consoleGlobal[TIMESTAMPED_CONSOLE_MARKER] = true;
    wrapConsoleLevel('info');
    wrapConsoleLevel('warn');
    wrapConsoleLevel('error');
    console.log = console.info.bind(console);
  }
}

/**
 * Wraps one console level with an ISO timestamp prefix.
 *
 * @param {SeverityLevel} level console level.
 */
function wrapConsoleLevel(level: SeverityLevel): void {
  const original = console[level].bind(console);
  console[level] = (...data: Parameters<Console[SeverityLevel]>): void => {
    original(`[${new Date().toISOString()}]`, ...data);
  };
}

installTimestampedConsole();
