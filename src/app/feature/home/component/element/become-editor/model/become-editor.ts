import {Become, COMBINE_BECOME_KIND, FIXED_BECOME_KIND, SAME_BECOME_KIND, Tribe} from '~gol/feature/home/model/rule';

/**
 * Outcome editor mode.
 *
 * @typedef {BecomeMode}
 */
export type BecomeMode = Become<Tribe[]>['kind'];

/**
 * Combine outcome handled by the lookup table UI.
 *
 * @typedef {CombineBecome}
 */
export type CombineBecome = Extract<Become<Tribe[]>, {kind: typeof COMBINE_BECOME_KIND}>;

/**
 * Simplified nested outcome mode.
 *
 * @typedef {NestedBecomeMode}
 */
export type NestedBecomeMode = typeof FIXED_BECOME_KIND | typeof SAME_BECOME_KIND | typeof COMBINE_BECOME_KIND;

/**
 * Editable combine target.
 *
 * @typedef {CombineTarget}
 */
export type CombineTarget = 'root' | 'tie' | 'fallback';

/**
 * Label shared by fixed outcome controls.
 *
 * @type {"Fixed tribe"}
 */
export const FIXED_TRIBE_LABEL = 'Fixed tribe';
