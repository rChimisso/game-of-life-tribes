/**
 * Control error message resolver.
 *
 * @typedef {ControlErrorMessage}
 */
export type ControlErrorMessage = string | ((error: unknown) => string);

/**
 * Ordered control error resolver entry.
 *
 * @typedef {ControlErrorResolver}
 */
export type ControlErrorResolver = readonly [
  errorName: string,
  message: ControlErrorMessage
];
