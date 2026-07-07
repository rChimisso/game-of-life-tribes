import {AFTERIMAGE_PRESET} from './afterimage';
import {ANNEAL_PRESET} from './anneal';
import {CONWAY_PRESET} from './conway';
import {DAY_AND_NIGHT_PRESET} from './day-and-night';
import {DIAMOEBA_PRESET} from './diamoeba';
import {ETERNAL_PRESET} from './eternal';
import {Preset} from './model/preset';
import {REPLICATOR_PRESET} from './replicator';
import {SENESCENCE_PRESET} from './senescence';
import {SLIME_MOLD_PRESET} from './slime-mold';
import {WILDFIRE_PRESET} from './wildfire';

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
