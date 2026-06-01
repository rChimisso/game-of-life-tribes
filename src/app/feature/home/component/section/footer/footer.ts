import {ChangeDetectionStrategy, Component} from '@angular/core';

import packageJson from '../../../../../../../package.json';

/**
 * Sidebar footer.
 *
 * @class HomeFooter
 * @typedef {HomeFooter}
 */
@Component({
  selector: 'gol-home-footer',
  standalone: true,
  templateUrl: './footer.html',
  styleUrl: './footer.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class HomeFooter {
  /**
   * Application version from package.json.
   *
   * @public
   * @readonly
   * @type {string}
   */
  public readonly appVersion = packageJson.version;

  /**
   * Repository URL.
   *
   * @public
   * @readonly
   * @type {string}
   */
  public readonly repoUrl = 'https://github.com/rChimisso/game-of-life-tribes';
}
