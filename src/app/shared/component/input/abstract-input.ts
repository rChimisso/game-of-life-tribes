import {Directive, Input} from '@angular/core';

import {ValidatingCvaComponent} from '~gol/core/abstract/validating-cva-component';

/**
 * Common scalar input API.
 *
 * @abstract
 * @class AbstractInputComponent
 * @typedef {AbstractInputComponent}
 * @template T
 * @extends {ValidatingCvaComponent<T>}
 */
@Directive()
export abstract class AbstractInputComponent<T> extends ValidatingCvaComponent<T> {
  /**
   * Input placeholder.
   *
   * @public
   * @type {string}
   */
  @Input()
  public placeholder = '';

  /**
   * Input tooltip.
   *
   * @public
   * @type {string}
   */
  @Input()
  public tooltip = '';

  /**
   * Input autocomplete mode.
   *
   * @public
   * @type {(string | undefined)}
   */
  @Input()
  public autocomplete?: string;
}
