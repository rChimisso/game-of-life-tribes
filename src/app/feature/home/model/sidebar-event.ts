import {Rule, Tribe} from './rule';
import {TribeRenamePair} from '../util/tribe-impact';

/**
 * Sidebar action payload emitted to Home.
 */
export interface SidebarEvent {
  action:
    | 'toggleRun'
    | 'restart'
    | 'selectTribe'
    | 'selectTribes'
    | 'setSpeed'
    | 'setMaxSpeed'
    | 'setRecording'
    | 'setGridSize'
    | 'download'
    | 'saveState'
    | 'loadState'
    | 'deleteMode'
    | 'updateTribes'
    | 'updateRules'
    | 'stepBack'
    | 'stepForward'
    | 'setBrushSize'
    | 'setBrushShape'
    | 'setBrushFill'
    | 'togglePanMode'
    | 'cancelDownload'
    | 'setPacking'
    | 'applyPreset';
  value?: unknown;
}

/**
 * Payload emitted when applying pending tribe edits.
 */
export interface UpdateTribesPayload {
  tribes: Tribe[];
  renamePairs: TribeRenamePair[];
}

/**
 * Payload emitted when applying pending rule edits.
 */
export interface UpdateRulesPayload {
  rules: Rule<Tribe[]>[];
}
