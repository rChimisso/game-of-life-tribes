import {AFTERIMAGE_PRESET} from './afterimage';
import {ANNEAL_PRESET} from './anneal';
import {COLOR_MIXING_PRESET} from './color-mixing';
import {CONWAY_PRESET} from './conway';
import {CULTURAL_DRIFT_PRESET} from './cultural-drift';
import {CYCLIC_DOMINANCE_PRESET} from './cyclic-dominance';
import {DAY_AND_NIGHT_PRESET} from './day-and-night';
import {EPIDEMIC_PRESET} from './epidemic';
import {REPLICATOR_PRESET} from './replicator';
import {SENESCENCE_PRESET} from './senescence';
import {SLIME_MOLD_PRESET} from './slime-mold';
import {WILDFIRE_PRESET} from './wildfire';
import {Tribe, Rule, IS_CLAUSE_KIND, FIXED_BECOME_KIND, Ruleset, SAME_BECOME_KIND} from '../model/rule';

/**
 * Builds a rule that keeps the same cell state.
 *
 * @template {readonly Tribe[]} T
 * @param {...[string, ...string[]]} tribes tribe ID.
 * @returns {Rule<T>} transition rule for the change step.
 */
export function staticRule<T extends readonly Tribe[]>(...tribes: [string, ...string[]]): Rule<T> {
  return {
    clause: {
      kind: IS_CLAUSE_KIND,
      tribes
    },
    become: {
      kind: SAME_BECOME_KIND
    }
  };
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
 * Available built-in presets.
 *
 * @type {readonly Preset[]}
 */
export const PRESETS: readonly Preset[] = [
  CONWAY_PRESET,
  REPLICATOR_PRESET,
  DAY_AND_NIGHT_PRESET,
  ANNEAL_PRESET,
  SENESCENCE_PRESET,
  AFTERIMAGE_PRESET,
  CYCLIC_DOMINANCE_PRESET,
  CULTURAL_DRIFT_PRESET,
  EPIDEMIC_PRESET,
  WILDFIRE_PRESET,
  SLIME_MOLD_PRESET,
  COLOR_MIXING_PRESET
];
