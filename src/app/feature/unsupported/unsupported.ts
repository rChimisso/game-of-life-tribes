import {Component} from '@angular/core';
import {Store} from '@ngrx/store';

import {openBlank} from '~gol/core/redux/actions';
import {SeoService} from '~gol/core/service/seo';
import {StatusAction} from '~gol/shared/component/status-page/model/status-page-action';
import {StatusPage} from '~gol/shared/component/status-page/status-page';

/**
 * WebGPU unsupported page.
 *
 * @class UnsupportedPage
 * @typedef {UnsupportedPage}
 */
@Component({
  selector: 'gol-unsupported',
  standalone: true,
  imports: [StatusPage],
  templateUrl: './unsupported.html',
  styleUrl: './unsupported.scss'
})
export class UnsupportedPage {
  /**
   * Status page error details.
   *
   * @public
   * @readonly
   * @type {string[]}
   */
  public readonly details = ['Your browser or device does not support WebGPU, which is required to run this project.', 'Try updating your browser or switching to a supported one.'];

  /**
   * Status page actions.
   *
   * @public
   * @readonly
   * @type {StatusAction[]}
   */
  public readonly actions: StatusAction[] = [
    {
      id: 'check-support',
      icon: 'open_in_new',
      label: 'Check support',
      execute: () => this.store$.dispatch(openBlank({link: 'https://caniuse.com/webgpu'}))
    },
    {
      id: 'wiki',
      icon: 'menu_book',
      label: 'Wiki',
      route: '/wiki'
    }
  ];

  /**
   * @constructor
   * @public
   * @param {Store} store$
   * @param {SeoService} seo document metadata service.
   */
  public constructor(private readonly store$: Store, seo: SeoService) {
    seo.setNoIndex('WebGPU unsupported', 'This browser or device does not support the WebGPU API required by Game of Life: Tribes.');
  }
}
