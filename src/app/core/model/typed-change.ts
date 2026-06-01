import type {SimpleChange} from '@angular/core';

/**
 * Typed {@link SimpleChange}.
 *
 * @typedef {TypedChange}
 * @template T
 */
export type TypedChange<T> = SimpleChange & {previousValue: T; currentValue: T};

/**
 * Typed {@link SimpleChanges}.
 *
 * @typedef {TypedChanges}
 * @template T
 */
export type TypedChanges<T> = {
  [K in keyof T]?: TypedChange<T[K]>
};
