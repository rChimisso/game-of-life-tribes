import {Component} from '@angular/core';
import {Router} from '@angular/router';
import {Store} from '@ngrx/store';

import {openIssue} from '~gol/core/redux/actions';
import {SeoService} from '~gol/core/service/seo';
import {StatusAction} from '~gol/shared/component/status-page/model/status-page-action';
import {StatusPage} from '~gol/shared/component/status-page/status-page';

/**
 * Error page.
 *
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
  /**
   * Status page error details.
   *
   * @public
   * @readonly
   * @type {string[]}
   */
  public readonly details = ['The page you\'re looking for doesn\'t exist. You might have mistyped the address, or the page may have been moved to a different URL.', 'Please return to the homepage or report the issue if you believe this is an error.'];

  /**
   * Status page actions.
   *
   * @public
   * @readonly
   * @type {StatusAction[]}
   */
  public readonly actions: StatusAction[] = [
    {
      id: 'home',
      icon: 'home',
      label: 'Homepage',
      route: '/'
    },
    {
      id: 'wiki',
      icon: 'menu_book',
      label: 'Wiki',
      route: '/wiki'
    },
    {
      id: 'report',
      icon: 'open_in_new',
      label: 'Report',
      execute: () => this.store$.dispatch(openIssue({
        title: 'Error 404 - Page not found',
        body: `I was trying to get to the page '${this.router.url.slice(1)}', but I ended up on the 404 page instead.`
      }))
    }
  ];

  /**
   * @constructor
   * @public
   * @param {Store} store$
   * @param {Router} router
   * @param {SeoService} seo document metadata service.
   */
  public constructor(private readonly store$: Store, private readonly router: Router, seo: SeoService) {
    seo.setNoIndex('Page not found', 'The requested Game of Life: Tribes page does not exist.');
  }
}
