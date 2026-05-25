/**
 * Offline metric entry written to Metrics CSV and JSON exports.
 *
 * @export
 * @interface OfflineMetricEntry
 * @typedef {OfflineMetricEntry}
 */
interface OfflineMetricEntry {
  /**
   * Message-compatible metric type.
   *
   * @type {'metrics'}
   */
  type: 'metrics';
  /**
   * Generation represented by this row.
   *
   * @type {number}
   */
  generation: number;
  /**
   * Population count by tribe ID.
   *
   * @type {Record<string, number>}
   */
  population: Record<string, number>;
  /**
   * Population delta from the previous exported metric row.
   *
   * @type {Record<string, number>}
   */
  populationDelta?: Record<string, number>;
  /**
   * Non-dead cell count.
   *
   * @type {number}
   */
  aliveCells: number;
  /**
   * Dead cell count.
   *
   * @type {number}
   */
  deadCells: number;
  /**
   * Fraction of non-dead cells.
   *
   * @type {number}
   */
  occupancy: number;
  /**
   * Shannon entropy among live tribes.
   *
   * @type {number}
   */
  shannonEntropy: number;
  /**
   * Simpson diversity index among live tribes.
   *
   * @type {number}
   */
  simpsonIndex: number;
  /**
   * Contact edges whose endpoints have the same state.
   *
   * @type {number}
   */
  sameStateContactEdges: number;
  /**
   * Contact edges whose endpoints have different states.
   *
   * @type {number}
   */
  crossStateContactEdges: number;
  /**
   * Fraction of contact edges whose endpoints have the same state.
   *
   * @type {number}
   */
  sameStateContactFraction: number;
  /**
   * Fraction of contact edges whose endpoints have different states.
   *
   * @type {number}
   */
  crossStateContactFraction: number;
  /**
   * Changed cells since the previous consecutive generation.
   *
   * @type {(number | null)}
   */
  changedCells: number | null;
  /**
   * Changed cell fraction since the previous consecutive generation.
   *
   * @type {(number | null)}
   */
  changedFraction: number | null;
  /**
   * Dead-to-live changes since the previous consecutive generation.
   *
   * @type {(number | null)}
   */
  births: number | null;
  /**
   * Live-to-dead changes since the previous consecutive generation.
   *
   * @type {(number | null)}
   */
  deaths: number | null;
  /**
   * Live tribe switches since the previous consecutive generation.
   *
   * @type {(number | null)}
   */
  tribeSwitches: number | null;
  /**
   * Live-cell count delta from the previous exported metric row.
   *
   * @type {(number | null)}
   */
  netGrowth: number | null;
  /**
   * Boundary length by non-dead tribe ID.
   *
   * @type {Record<string, number>}
   */
  frontierLength: Record<string, number>;
}

/**
 * Attractor episode detected during an offline Metrics export.
 *
 * @export
 * @interface AttractorEpisode
 * @typedef {AttractorEpisode}
 */
interface AttractorEpisode {
  /**
   * Whether a periodic orbit longer than one frame was reached.
   *
   * @type {boolean}
   */
  periodicOrbitReached: boolean;
  /**
   * Detected attractor class.
   *
   * @type {('fixed' | 'periodic')}
   */
  attractorClass: 'fixed' | 'periodic';
  /**
   * First generation in the detected orbit.
   *
   * @type {number}
   */
  startGeneration: number;
  /**
   * First generation that repeated the orbit start.
   *
   * @type {number}
   */
  firstRepeatGeneration: number;
  /**
   * Last generation that matched the detected orbit.
   *
   * @type {number}
   */
  endGeneration: number;
  /**
   * Number of generations before the orbit start.
   *
   * @type {number}
   */
  transientLength: number;
  /**
   * Orbit period length in generations.
   *
   * @type {number}
   */
  orbitPeriodLength: number;
  /**
   * Whether the attractor was verified by exact frame comparison.
   *
   * @type {boolean}
   */
  exact: boolean;
}

/**
 * Tribe extinction episode detected during an offline Metrics export.
 *
 * @interface ExtinctionEpisode
 * @typedef {ExtinctionEpisode}
 */
interface ExtinctionEpisode {
  /**
   * First observed generation where the tribe was absent after being alive.
   *
   * @type {number}
   */
  startGeneration: number;
  /**
   * Last observed generation where the tribe was absent, or null when still absent at export end.
   *
   * @type {(number | null)}
   */
  endGeneration: number | null;
  /**
   * Observed extinction duration in generations, or null when still absent at export end.
   *
   * @type {(number | null)}
   */
  duration: number | null;
}

/**
 * Metrics JSON summary.
 *
 * @export
 * @interface MetricsJsonSummary
 * @typedef {MetricsJsonSummary}
 */
interface MetricsJsonSummary {
  /**
   * First exported generation.
   *
   * @type {(number | null)}
   */
  generationStart: number | null;
  /**
   * Last exported generation.
   *
   * @type {(number | null)}
   */
  generationEnd: number | null;
  /**
   * Number of metric rows.
   *
   * @type {number}
   */
  frameCount: number;
  /**
   * Grid columns.
   *
   * @type {number}
   */
  cols: number;
  /**
   * Grid rows.
   *
   * @type {number}
   */
  rows: number;
  /**
   * First selected one-based frame index.
   *
   * @type {number}
   */
  selectedStartFrame: number;
  /**
   * Last selected one-based frame index.
   *
   * @type {number}
   */
  selectedEndFrame: number;
  /**
   * Selected frame count.
   *
   * @type {number}
   */
  selectedFrameCount: number;
  /**
   * Number of non-consecutive generation gaps.
   *
   * @type {number}
   */
  generationGapCount: number;
  /**
   * Detected attractor episodes.
   *
   * @type {AttractorEpisode[]}
   */
  attractors: AttractorEpisode[];
  /**
   * Extinction episodes by tribe ID.
   *
   * @type {Record<string, ExtinctionEpisode[]>}
   */
  extinctions: Record<string, ExtinctionEpisode[]>;
}

export type {AttractorEpisode, ExtinctionEpisode, MetricsJsonSummary, OfflineMetricEntry};
