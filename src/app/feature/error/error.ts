import {Component} from '@angular/core';
import {Router} from '@angular/router';
import {Store} from '@ngrx/store';

import {openIssue} from '~gol/core/redux/actions';
import {StatusPage, StatusPageAction} from '~gol/shared/component/status-page/status-page';

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
  imports: [StatusPage],
  templateUrl: './error.html',
  styleUrl: './error.scss'
})
export class ErrorPage {
  public readonly details = ['The page you\'re looking for doesn\'t exist. You might have mistyped the address, or the page may have been moved to a different URL.', 'Please return to the homepage or report the issue if you believe this is an error.'];

  public readonly actions: StatusPageAction[] = [
    {
      id: 'home',
      icon: 'home',
      label: 'Homepage',
      route: ''
    },
    {
      id: 'report',
      icon: 'open_in_new',
      label: 'Report'
    }
  ];

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

  public onActionClick(action: string): void {
    if (action === 'report') {
      this.openIssue();
    }
  }

  /**
   * Opens a new GitHub issue for the missing route.
   *
   * @public
   */
  public openIssue(): void {
    this.store$.dispatch(
      openIssue({
        title: 'Error 404 - Page not found',
        body: `I was trying to get to the page '${this.route}', but I ended up on the 404 page instead.`
      }),
    );
  }
}
