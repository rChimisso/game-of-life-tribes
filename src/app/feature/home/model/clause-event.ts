interface ClausePathEvent {
  ruleIndex: number;
  path: number[];
}

interface ChangeClauseKindEvent extends ClausePathEvent {
  newKind: string;
}

interface ToggleClauseTribeEvent extends ClausePathEvent {
  tribeId: string;
}

interface ToggleClauseEqTribeEvent extends ClausePathEvent {
  group: 1 | 2;
  tribeId: string;
}

interface SetClauseIntervalEvent extends ClausePathEvent {
  which: 0 | 1;
  value: string;
}

export type {ClausePathEvent,
  ChangeClauseKindEvent,
  ToggleClauseTribeEvent,
  ToggleClauseEqTribeEvent,
  SetClauseIntervalEvent};
