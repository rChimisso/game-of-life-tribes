import {Observable, defer, from} from 'rxjs';

/**
 * Converts a promise to an observable.
 *
 * @template T
 * @param {Promise<T>} promise
 * @returns {Observable<T>}
 */
export function observe<T>(promise: Promise<T>): Observable<T> {
  return defer(() => from(promise));
}
