/**
 * Formats a fraction as an integer percent.
 *
 * @export
 * @param {number} fraction completed fraction.
 * @returns {string} percent text.
 */
function formatPercent(fraction: number): string {
  return `${Math.round(Math.max(0, Math.min(1, fraction)) * 100)}%`;
}

export {formatPercent};
