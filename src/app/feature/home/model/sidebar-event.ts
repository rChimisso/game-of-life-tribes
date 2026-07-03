import {DownloadRequestPayload} from './download';
import {BrushFill, BrushShape} from './draw-mode';
import {BitsPerCell} from './grid-format';
import {LiveMetricSectionSettings} from './metrics';
import {Preset} from '../preset';
import {Rule, Tribe} from './rule';
import {TribeRenamePair} from './tribe-impact';

import {GridSettings} from '~gol/feature/home/model/grid';

/**
 * Sidebar action payload emitted to Home.
 */
export type SidebarEvent =
  | {action: 'toggleRun'}
  | {action: 'restart'}
  | {action: 'selectTribe'; value: string}
  | {action: 'selectTribes'; value: string[]}
  | {action: 'setSpeed'; value: number}
  | {action: 'setMaxSpeed'; value: boolean}
  | {action: 'setRecording'; value: boolean}
  | {action: 'setLiveMetrics'; value: {enabled: boolean; sections: LiveMetricSectionSettings}}
  | {action: 'setPopulationExpanded'; value: boolean}
  | {action: 'setDiversityExpanded'; value: boolean}
  | {action: 'setInterfacesExpanded'; value: boolean}
  | {action: 'setGridSize'; value: GridSettings}
  | {action: 'downloadSettingsChange'; value: DownloadRequestPayload}
  | {action: 'download'; value: DownloadRequestPayload}
  | {action: 'saveState'}
  | {action: 'loadState'; value: ArrayBuffer}
  | {action: 'deleteMode'}
  | {action: 'updateTribes'; value: UpdateTribesPayload}
  | {action: 'updateRules'; value: UpdateRulesPayload}
  | {action: 'stepBack'; value: number}
  | {action: 'stepForward'; value: number}
  | {action: 'setBrushSize'; value: number}
  | {action: 'setBrushShape'; value: BrushShape}
  | {action: 'setBrushFill'; value: BrushFill}
  | {action: 'setBrushDensity'; value: number}
  | {action: 'togglePanMode'}
  | {action: 'cancelDownload'}
  | {action: 'setPacking'; value: BitsPerCell}
  | {action: 'applyPreset'; value: Preset};

/**
 * Payload emitted when applying pending tribe edits.
 */
export interface UpdateTribesPayload {
  /**
   * Updated tribe list.
   *
   * @type {Tribe[]}
   */
  tribes: Tribe[];
  /**
   * Tribe rename mappings to apply to rules and boundary settings.
   *
   * @type {TribeRenamePair[]}
   */
  renamePairs: TribeRenamePair[];
}

/**
 * Payload emitted when applying pending rule edits.
 */
export interface UpdateRulesPayload {
  /**
   * Deterministic random seed for probabilistic rules.
   *
   * @type {number}
   */
  randomSeed: number;
  /**
   * Updated rule list.
   *
   * @type {Rule<Tribe[]>[]}
   */
  rules: Rule<Tribe[]>[];
}
