import {MatSnackBar, MatSnackBarConfig} from '@angular/material/snack-bar';

import {SeverityLevel} from '../../../core/model/severity-level';

/**
 * Logs snackbar messages with the same severity used by the UI.
 *
 * @param {string} message snackbar message.
 * @param {SeverityLevel} tone snackbar tone.
 */
function logHomeSnack(message: string, tone: SeverityLevel): void {
  switch (tone) {
    case 'info':
      console.info(`[GOLT] ${message}`);
      break;
    case 'warn':
      console.warn(`[GOLT] ${message}`);
      break;
    case 'error':
      console.error(`[GOLT] ${message}`);
      break;
  }
}

/**
 * Opens a snackbar and logs the same message.
 *
 * @param {MatSnackBar} snackBar snackbar service.
 * @param {string} message snackbar message.
 * @param {SeverityLevel} tone snackbar tone.
 * @param {number} duration snackbar duration in milliseconds.
 */
export function openHomeSnack(snackBar: MatSnackBar, message: string, tone: SeverityLevel, duration: number = 0): void {
  logHomeSnack(message, tone);
  const panelTone = tone === 'warn' ? 'warning' : tone;
  const config: MatSnackBarConfig = {panelClass: `snackbar-${panelTone}`};
  if (duration > 0) {
    config.duration = duration;
  }
  snackBar.open(message, 'Dismiss', config);
}
