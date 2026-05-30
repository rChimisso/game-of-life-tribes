/**
 * Creates a stable ZIP entry path for one PNG frame.
 *
 * @export
 * @param {number} frameNumber one-based exported frame number.
 * @param {number} filenameFrameWidth zero-padded frame width.
 * @param {number} generation frame generation.
 * @returns {string} PNG ZIP entry path.
 */
function createPngFrameEntryPath(frameNumber: number, filenameFrameWidth: number, generation: number): string {
  const frameNumberText = String(frameNumber).padStart(filenameFrameWidth, '0');
  return `frames/frame-${frameNumberText}-gen${sanitizeGeneration(generation)}.png`;
}

/**
 * Sanitizes a generation number for use in a filename.
 *
 * @param {number} generation generation number.
 * @returns {string} filename-safe generation.
 */
function sanitizeGeneration(generation: number): string {
  return generation < 0 ? `neg${Math.abs(generation)}` : String(generation);
}

export {createPngFrameEntryPath};
