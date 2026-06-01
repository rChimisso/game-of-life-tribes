import {Component, Input} from '@angular/core';
import {RouterModule} from '@angular/router';

import {Button} from '../button/button';
import {StatusAction} from './model/status-page-action';

/**
 * Status page for blocking errors.
 *
 * @class StatusPage
 * @typedef {StatusPage}
 */
@Component({
  selector: 'gol-status-page',
  standalone: true,
  imports: [RouterModule, Button],
  templateUrl: './status-page.html',
  styleUrl: './status-page.scss'
})
export class StatusPage {
  /**
   * Status code.
   *
   * @public
   * @type {!string}
   */
  @Input({required: true})
  public code!: string;

  /**
   * Error desctiption.
   *
   * @public
   * @type {!string}
   */
  @Input({required: true})
  public description!: string;

  /**
   * Error details.
   *
   * @public
   * @type {string[]}
   */
  @Input({required: true})
  public details: string[] = [];

  /**
   * Available actions.
   *
   * @public
   * @type {StatusAction[]}
   */
  @Input()
  public actions: StatusAction[] = [];
}
