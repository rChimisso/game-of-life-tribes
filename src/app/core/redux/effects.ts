import {Injectable} from '@angular/core';
import {Actions, createEffect, ofType} from '@ngrx/effects';
import {ignoreElements, tap} from 'rxjs';

import {openIssue} from './actions';

/**
 * Core effects.
 *
 * @export
 * @class CoreEffects
 * @typedef {CoreEffects}
 */
@Injectable()
export class CoreEffects {
  /**
   * Intercepts the action {@link openIssue} to open a new GitHub issue with precompiled fields.
   *
   * @public
   * @readonly
   * @type {Observable<never>}
   */
  public readonly openIssue$ = createEffect(() => this.actions$.pipe(
    ofType(openIssue),
    tap(({title, body}) => window.open(
      `https://github.com/rChimisso/game-of-life-tribes/issues/new?assignees=Crystal-Spider&labels=question&title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`,
      '_blank'
    )),
    ignoreElements()
  ), {dispatch: false});

  /**
   * @constructor
   * @public
   * @param {Actions} actions$
   */
  public constructor(private readonly actions$: Actions) {}
}
