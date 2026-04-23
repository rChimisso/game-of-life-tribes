import {Injectable} from '@angular/core';
import {Actions, createEffect, ofType} from '@ngrx/effects';
import {ignoreElements, map, tap} from 'rxjs';

import {openBlank, openIssue} from './actions';

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
    map(({title, body}) => openBlank({link: `https://github.com/rChimisso/game-of-life-tribes/issues/new?assignees=Crystal-Spider&labels=question&title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`}))
  ));

  /**
   * Intercepts the action {@link openIssue} to open a new GitHub issue with precompiled fields.
   *
   * @public
   * @readonly
   * @type {Observable<never>}
   */
  public readonly openBlank$ = createEffect(() => this.actions$.pipe(
    ofType(openBlank),
    tap(({link}) => window.open(link, '_blank')),
    ignoreElements()
  ), {dispatch: false});

  /**
   * @constructor
   * @public
   * @param {Actions} actions$
   */
  public constructor(private readonly actions$: Actions) {}
}
