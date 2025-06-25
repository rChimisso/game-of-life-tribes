import {Component} from '@angular/core';
import {Router, RouterModule} from '@angular/router';
import {Store} from '@ngrx/store';

import {openIssue} from '~gol/core/redux/actions';
import {Button} from '~gol/shared/component/button/button';

/**
 * Error page.
 *
 * @export
 * @class ErrorPage
 * @typedef {ErrorPage}
 */
@Component({
  selector: 'gol-error',
  standalone: true,
  imports: [RouterModule, Button],
  templateUrl: './error.html',
  styleUrl: './error.scss'
})
export class ErrorPage {
  /**
   * Current route.
   *
   * @public
   * @readonly
   * @type {string}
   */
  public get route() {
    return this.router.url.slice(1);
  }

  /**
   * @constructor
   * @public
   * @param {Store} store$
   * @param {Router} router
   */
  public constructor(private readonly store$: Store, private readonly router: Router) {}

  /**
   * Opens a new GitHub issue for the missing route.
   *
   * @public
   */
  public openIssue() {
    this.store$.dispatch(
      openIssue({
        title: 'Error 404 - Page not found',
        body: `I was trying to get to the page '${this.route}', but I ended up on the 404 page instead.`
      }),
    );
  }
}
