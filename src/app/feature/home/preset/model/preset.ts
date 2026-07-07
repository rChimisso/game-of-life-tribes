import {Ruleset} from '../../model/rule';

/**
 * Named application preset.
 *
 * @interface Preset
 * @typedef {Preset}
 */
export interface Preset {
  /**
   * Preset display name.
   *
   * @type {string}
   */
  readonly name: string;
  /**
   * Preset short description.
   *
   * @type {string}
   */
  readonly description: string;
  /**
   * Ruleset loaded by the preset.
   *
   * @type {Omit<Ruleset, 'cols' | 'rows' | 'topology' | 'boundaryTribe' | 'randomSeed'> & Partial<Pick<Ruleset, 'randomSeed'>>}
   */
  readonly ruleset: Omit<Ruleset, 'cols' | 'rows' | 'topology' | 'boundaryTribe' | 'randomSeed'> & Partial<Pick<Ruleset, 'randomSeed'>>;
}
