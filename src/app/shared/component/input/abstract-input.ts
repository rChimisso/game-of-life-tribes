import {Directive, Input} from '@angular/core';

import {CvaComponent} from '~gol/core/abstract/cva-component';

/**
 * Common scalar input API.
 *
 * @abstract
 * @class AbstractInputComponent
 * @typedef {AbstractInputComponent}
 * @template T
 * @extends {CvaComponent<T>}
 */
@Directive()
export abstract class AbstractInputComponent<T> extends CvaComponent<T> {
  /**
   * Input placeholder.
   *
   * @public
   * @type {string}
   */
  @Input()
  public placeholder = '';

  /**
   * Input autocomplete mode.
   *
   * @public
   * @type {(string | undefined)}
   */
  @Input()
  public autocomplete?: string;
}
