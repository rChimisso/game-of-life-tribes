import {ChangeDetectionStrategy, Component} from '@angular/core';
import {RouterLink} from '@angular/router';

import packageJson from '~package';

/**
 * Wiki navigation footer.
 *
 * @class WikiFooter
 * @typedef {WikiFooter}
 */
@Component({
  selector: 'gol-wiki-footer',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './wiki-footer.html',
  styleUrl: './wiki-footer.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class WikiFooter {
  /**
   * Application version from package.json.
   *
   * @public
   * @readonly
   * @type {string}
   */
  public readonly appVersion: string = packageJson.version;

  /**
   * Project repository URL.
   *
   * @public
   * @readonly
   * @type {string}
   */
  public readonly repositoryUrl = 'https://github.com/rChimisso/game-of-life-tribes';
}
