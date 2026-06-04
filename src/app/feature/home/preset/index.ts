import {AFTERIMAGE_PRESET} from './afterimage';
import {ANNEAL_PRESET} from './anneal';
import {CONWAY_PRESET} from './conway';
import {DAY_AND_NIGHT_PRESET} from './day-and-night';
import {DIAMOEBA_PRESET} from './diamoeba';
import {ETERNAL_PRESET} from './eternal';
import {REPLICATOR_PRESET} from './replicator';
import {SENESCENCE_PRESET} from './senescence';
import {WILDFIRE_PRESET} from './wildfire';
import {Ruleset} from '../model/rule';

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
   * @type {Omit<Ruleset, 'cols' | 'rows'>}
   */
  readonly ruleset: Omit<Ruleset, 'cols' | 'rows'>;
}

/**
 * Available built-in presets.
 *
 * @type {readonly Preset[]}
 */
export const PRESETS: readonly Preset[] = [
  CONWAY_PRESET,
  REPLICATOR_PRESET,
  ETERNAL_PRESET,
  DIAMOEBA_PRESET,
  DAY_AND_NIGHT_PRESET,
  ANNEAL_PRESET,
  AFTERIMAGE_PRESET,
  SENESCENCE_PRESET,
  WILDFIRE_PRESET
];
