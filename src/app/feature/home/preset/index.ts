import {AFTERIMAGE_PRESET} from './afterimage';
import {ANNEAL_PRESET} from './anneal';
import {CONWAY_PRESET} from './conway';
import {DAY_AND_NIGHT_PRESET} from './day-and-night';
import {DIAMOEBA_PRESET} from './diamoeba';
import {ETERNAL_PRESET} from './eternal';
import {REPLICATOR_PRESET} from './replicator';
import {SENESCENCE_PRESET} from './senescence';
import {SLIME_MOLD_PRESET} from './slime-mold';
import {WILDFIRE_PRESET} from './wildfire';
import {FIXED_BECOME_KIND, IS_CLAUSE_KIND, Rule, Ruleset, Tribe} from '../model/rule';

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

/**
 * Builds a rule that changes a cell from one tribe to another.
 *
 * @template {readonly Tribe[]} T
 * @param {string} fromTribe current tribe ID.
 * @param {string} toTribe next tribe ID.
 * @returns {Rule<T>} transition rule for the change step.
 */
export function directRule<T extends readonly Tribe[]>(fromTribe: string, toTribe: string): Rule<T> {
  return {
    clause: {
      kind: IS_CLAUSE_KIND,
      tribes: [fromTribe]
    },
    become: {
      kind: FIXED_BECOME_KIND,
      tribe: toTribe
    }
  };
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
  SLIME_MOLD_PRESET,
  WILDFIRE_PRESET
];
