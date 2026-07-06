import {Tribe, TribeSelector} from '~gol/feature/home/model/rule';

/**
 * Selector kind editable in the selector editor.
 *
 * @typedef {TribeSelectorKind}
 */
export type TribeSelectorKind = TribeSelector<Tribe[]>['kind'];
