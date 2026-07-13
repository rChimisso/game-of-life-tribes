import {validateBecomeSemantics} from '~gol/feature/home/logic/become-validation';
import {isSupportedBitsPerCell, validatePackingAgainstStateCount} from '~gol/feature/home/logic/grid-format';
import {AND_CLAUSE_KIND, Become, BOUNDED_GRID_TOPOLOGY, COMBINE_BECOME_KIND, COMPARISON_CLAUSE_KIND, COUNT_CLAUSE_KIND, DEAD_TRIBE_ID, DEFAULT_RANDOM_SEED, DEFAULT_RULE_PROBABILITY, DIFFERENT_IN_TRIBE_SELECTOR_KIND, DIFFERENT_TRIBE_SELECTOR_KIND, EMPTY_CLAUSE_KIND, EXACTLY_CLAUSE_KIND, FIXED_BECOME_KIND, GRID_TOPOLOGY_VALUES, IS_CLAUSE_KIND, MAJORITY_BECOME_KIND, MAX_CLAUSE_KIND, MAX_RANDOM_SEED, MAX_RULE_PROBABILITY, MIN_CLAUSE_KIND, MINORITY_BECOME_KIND, MIN_RANDOM_SEED, MIN_RULE_PROBABILITY, NONE_CLAUSE_KIND, NOT_CLAUSE_KIND, OR_CLAUSE_KIND, SAME_BECOME_KIND, SAME_TRIBE_SELECTOR_KIND, TOROIDAL_GRID_TOPOLOGY, Tribe, TRIBES_SELECTOR_KIND, XOR_CLAUSE_KIND} from '~gol/feature/home/model/rule';
import {EXPECTED_KNOWN_TRIBE_ID_ERROR, INVALID_SNAPSHOT_PAYLOAD_MESSAGE, OPERATORS, type SanitizerContext, type UnknownRecord} from '~gol/feature/home/worker/snapshot/model/golt-header-sanitizer';
import {GoltHeader} from '~gol/feature/home/worker/snapshot/model/golt-types';

/**
 * Checks whether a value is a plain JSON object.
 *
 * @param {unknown} value value to inspect.
 * @returns {value is UnknownRecord} whether the value is a record.
 */
function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Appends a field path segment.
 *
 * @param {string} path parent path.
 * @param {string} field field name.
 * @returns {string} child path.
 */
function fieldPath(path: string, field: string): string {
  return path ? `${path}.${field}` : field;
}

/**
 * Appends an array index path segment.
 *
 * @param {string} path parent path.
 * @param {number} index array index.
 * @returns {string} child path.
 */
function indexPath(path: string, index: number): string {
  return `${path}[${index}]`;
}

/**
 * Records unknown fields on one recognized object.
 *
 * @param {UnknownRecord} value object to inspect.
 * @param {string} path object path.
 * @param {readonly string[]} supported supported field names.
 * @param {SanitizerContext} context sanitizer context.
 */
function stripUnsupportedFields(value: UnknownRecord, path: string, supported: readonly string[], context: SanitizerContext): void {
  const supportedFields = new Set(supported);
  for (const key of Object.keys(value)) {
    if (!supportedFields.has(key)) {
      context.strippedFields.push(fieldPath(path, key));
    }
  }
}

/**
 * Records one validation error.
 *
 * @param {SanitizerContext} context sanitizer context.
 * @param {string} path invalid value path.
 * @param {string} reason validation reason.
 */
function addError(context: SanitizerContext, path: string, reason: string): void {
  context.errors.push(`${path || '<root>'}: ${reason}`);
}

/**
 * Checks whether a value is an integer in a closed range.
 *
 * @param {unknown} value value to inspect.
 * @param {number} min minimum value.
 * @param {number} max maximum value.
 * @returns {value is number} whether the value is valid.
 */
function isIntegerInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

/**
 * Sanitizes and validates a required integer field.
 *
 * @param {UnknownRecord} source source object.
 * @param {string} key field key.
 * @param {number} min minimum value.
 * @param {number} max maximum value.
 * @param {string} path parent path.
 * @param {SanitizerContext} context sanitizer context.
 * @returns {number} sanitized integer.
 */
function sanitizeRequiredInteger(source: UnknownRecord, key: string, min: number, max: number, path: string, context: SanitizerContext): number {
  const value = source[key];
  let sanitized = min;
  if (isIntegerInRange(value, min, max)) {
    sanitized = value;
  } else if (value === undefined) {
    addError(context, fieldPath(path, key), 'missing required integer');
  } else {
    addError(context, fieldPath(path, key), `expected integer from ${min} to ${max}`);
  }
  return sanitized;
}

/**
 * Sanitizes and validates an optional integer field with an explicit default.
 *
 * @param {UnknownRecord} source source object.
 * @param {string} key field key.
 * @param {number} min minimum value.
 * @param {number} max maximum value.
 * @param {SanitizerContext} context sanitizer context.
 * @returns {number | undefined} sanitized integer.
 */
function sanitizeOptionalInteger(source: UnknownRecord, key: string, min: number, max: number, context: SanitizerContext): number | undefined {
  const value = source[key];
  let sanitized: number | undefined;
  if (value === undefined) {
    sanitized = undefined;
  } else if (isIntegerInRange(value, min, max)) {
    sanitized = value;
  } else {
    addError(context, key, `expected integer from ${min} to ${max}`);
  }
  return sanitized;
}

/**
 * Sanitizes one tribe.
 *
 * @param {unknown} value raw tribe value.
 * @param {string} path tribe path.
 * @param {SanitizerContext} context sanitizer context.
 * @returns {{id: string; color: string}} sanitized tribe.
 */
function sanitizeTribe(value: unknown, path: string, context: SanitizerContext): {id: string; color: string} {
  const tribe = {id: '', color: '000000'};
  if (isRecord(value)) {
    stripUnsupportedFields(value, path, ['id', 'color'], context);
    if (typeof value['id'] === 'string' && /^[A-Za-z0-9]+$/.test(value['id'])) {
      tribe.id = value['id'];
    } else {
      addError(context, fieldPath(path, 'id'), 'expected non-empty alphanumeric tribe id');
    }
    if (typeof value['color'] === 'string' && /^[0-9a-fA-F]{6}$/.test(value['color'])) {
      tribe.color = value['color'];
    } else {
      addError(context, fieldPath(path, 'color'), 'expected six-digit RGB hex color');
    }
  } else {
    addError(context, path, 'expected tribe object');
  }
  return tribe;
}

/**
 * Sanitizes the tribe list and validates IDs.
 *
 * @param {unknown} value raw tribe list.
 * @param {SanitizerContext} context sanitizer context.
 * @returns {{id: string; color: string}[]} sanitized tribes.
 */
function sanitizeTribes(value: unknown, context: SanitizerContext): {id: string; color: string}[] {
  const tribes: {id: string; color: string}[] = [];
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index++) {
      tribes.push(sanitizeTribe(value[index], indexPath('tribes', index), context));
    }
    const ids = new Set<string>();
    for (const tribe of tribes) {
      if (tribe.id && ids.has(tribe.id)) {
        addError(context, 'tribes', `duplicate tribe id "${tribe.id}"`);
      }
      ids.add(tribe.id);
    }
    if (!ids.has(DEAD_TRIBE_ID)) {
      addError(context, 'tribes', `missing required "${DEAD_TRIBE_ID}" tribe`);
    }
  } else if (value === undefined) {
    addError(context, 'tribes', 'missing required tribe list');
  } else {
    addError(context, 'tribes', 'expected tribe array');
  }
  return tribes;
}

/**
 * Sanitizes grid format metadata.
 *
 * @param {unknown} value raw grid format value.
 * @param {number} tribeCount sanitized tribe count.
 * @param {SanitizerContext} context sanitizer context.
 * @returns {{bitsPerCell: 1 | 2 | 4 | 8 | 16 | 32}} sanitized grid format.
 */
function sanitizeGridFormat(value: unknown, tribeCount: number, context: SanitizerContext): {bitsPerCell: 1 | 2 | 4 | 8 | 16 | 32} {
  let bitsPerCell: 1 | 2 | 4 | 8 | 16 | 32 = 8;
  if (isRecord(value)) {
    stripUnsupportedFields(value, 'gridFormat', ['bitsPerCell'], context);
    const rawBits = value['bitsPerCell'];
    if (typeof rawBits === 'number' && isSupportedBitsPerCell(rawBits)) {
      bitsPerCell = rawBits;
      if (!validatePackingAgainstStateCount(bitsPerCell, tribeCount)) {
        addError(context, 'gridFormat.bitsPerCell', 'cannot represent every tribe state');
      }
    } else {
      addError(context, 'gridFormat.bitsPerCell', 'expected supported bits-per-cell value');
    }
  } else if (value === undefined) {
    addError(context, 'gridFormat', 'missing required grid format');
  } else {
    addError(context, 'gridFormat', 'expected grid format object');
  }
  return {bitsPerCell};
}

/**
 * Sanitizes an optional selector field with the application's explicit default.
 *
 * @param {unknown} value raw selector value.
 * @param {string} path selector path.
 * @param {ReadonlySet<string>} tribeIds known tribe IDs.
 * @param {SanitizerContext} context sanitizer context.
 * @returns {unknown} sanitized selector.
 */
function sanitizeOptionalSelector(value: unknown, path: string, tribeIds: ReadonlySet<string>, context: SanitizerContext): unknown {
  let selector: unknown;
  if (value === undefined) {
    selector = {
      kind: TRIBES_SELECTOR_KIND,
      tribes: [DEAD_TRIBE_ID]
    };
  } else {
    selector = sanitizeSelector(value, path, tribeIds, context);
  }
  return selector;
}

/**
 * Sanitizes a selector discriminated union.
 *
 * @param {unknown} value raw selector value.
 * @param {string} path selector path.
 * @param {ReadonlySet<string>} tribeIds known tribe IDs.
 * @param {SanitizerContext} context sanitizer context.
 * @returns {unknown} sanitized selector.
 */
function sanitizeSelector(value: unknown, path: string, tribeIds: ReadonlySet<string>, context: SanitizerContext): unknown {
  let selector: unknown = {kind: TRIBES_SELECTOR_KIND, tribes: [DEAD_TRIBE_ID]};
  if (isRecord(value)) {
    const {kind} = value;
    switch (kind) {
      case TRIBES_SELECTOR_KIND:
      case DIFFERENT_IN_TRIBE_SELECTOR_KIND:
        stripUnsupportedFields(value, path, ['kind', 'tribes'], context);
        selector = {
          kind,
          tribes: sanitizeTribeReferences(value['tribes'], fieldPath(path, 'tribes'), tribeIds, context)
        };
        break;
      case SAME_TRIBE_SELECTOR_KIND:
      case DIFFERENT_TRIBE_SELECTOR_KIND:
        stripUnsupportedFields(value, path, ['kind'], context);
        selector = {kind};
        break;
      default:
        addError(context, fieldPath(path, 'kind'), 'unsupported selector kind');
        break;
    }
  } else {
    addError(context, path, 'expected selector object');
  }
  return selector;
}

/**
 * Sanitizes a non-empty tribe-reference array.
 *
 * @param {unknown} value raw tribe references.
 * @param {string} path value path.
 * @param {ReadonlySet<string>} tribeIds known tribe IDs.
 * @param {SanitizerContext} context sanitizer context.
 * @returns {string[]} sanitized tribe references.
 */
function sanitizeTribeReferences(value: unknown, path: string, tribeIds: ReadonlySet<string>, context: SanitizerContext): string[] {
  const references: string[] = [];
  if (Array.isArray(value)) {
    if (value.length > 0) {
      for (let index = 0; index < value.length; index++) {
        const item = value[index];
        if (typeof item === 'string' && tribeIds.has(item)) {
          references.push(item);
        } else {
          addError(context, indexPath(path, index), EXPECTED_KNOWN_TRIBE_ID_ERROR);
        }
      }
    } else {
      addError(context, path, 'expected at least one tribe id');
    }
  } else {
    addError(context, path, 'expected tribe id array');
  }
  return references;
}

/**
 * Sanitizes a count expression.
 *
 * @param {unknown} value raw expression.
 * @param {string} path expression path.
 * @param {ReadonlySet<string>} tribeIds known tribe IDs.
 * @param {SanitizerContext} context sanitizer context.
 * @returns {unknown} sanitized expression.
 */
function sanitizeCountExpression(value: unknown, path: string, tribeIds: ReadonlySet<string>, context: SanitizerContext): unknown {
  let expression: unknown = {
    kind: COUNT_CLAUSE_KIND,
    selector: sanitizeOptionalSelector(undefined, fieldPath(path, 'selector'), tribeIds, context)
  };
  if (isRecord(value)) {
    stripUnsupportedFields(value, path, ['kind', 'selector'], context);
    if (value['kind'] === COUNT_CLAUSE_KIND) {
      expression = {
        kind: COUNT_CLAUSE_KIND,
        selector: sanitizeOptionalSelector(value['selector'], fieldPath(path, 'selector'), tribeIds, context)
      };
    } else {
      addError(context, fieldPath(path, 'kind'), 'expected count expression kind');
    }
  } else {
    addError(context, path, 'expected count expression object');
  }
  return expression;
}

/**
 * Sanitizes an optional count expression with the application's explicit default.
 *
 * @param {unknown} value raw expression.
 * @param {string} path expression path.
 * @param {ReadonlySet<string>} tribeIds known tribe IDs.
 * @param {SanitizerContext} context sanitizer context.
 * @returns {unknown} sanitized expression.
 */
function sanitizeOptionalCountExpression(value: unknown, path: string, tribeIds: ReadonlySet<string>, context: SanitizerContext): unknown {
  let expression: unknown;
  if (value === undefined) {
    expression = {
      kind: COUNT_CLAUSE_KIND,
      selector: sanitizeOptionalSelector(undefined, fieldPath(path, 'selector'), tribeIds, context)
    };
  } else {
    expression = sanitizeCountExpression(value, path, tribeIds, context);
  }
  return expression;
}

/**
 * Sanitizes a neighbor count.
 *
 * @param {unknown} value raw count.
 * @param {string} path count path.
 * @param {SanitizerContext} context sanitizer context.
 * @returns {number} sanitized count.
 */
function sanitizeNeighborCount(value: unknown, path: string, context: SanitizerContext): number {
  let count = 0;
  if (isIntegerInRange(value, 0, 8)) {
    count = value;
  } else {
    addError(context, path, 'expected integer neighbor count from 0 to 8');
  }
  return count;
}

/**
 * Sanitizes a rule clause discriminated union.
 *
 * @param {unknown} value raw clause value.
 * @param {string} path clause path.
 * @param {ReadonlySet<string>} tribeIds known tribe IDs.
 * @param {SanitizerContext} context sanitizer context.
 * @returns {unknown} sanitized clause.
 */
function sanitizeClause(value: unknown, path: string, tribeIds: ReadonlySet<string>, context: SanitizerContext): unknown {
  let clause: unknown = {kind: EMPTY_CLAUSE_KIND};
  if (isRecord(value)) {
    const {kind} = value;
    switch (kind) {
      case EMPTY_CLAUSE_KIND:
        stripUnsupportedFields(value, path, ['kind'], context);
        addError(context, path, 'empty clauses are not valid in loaded rules');
        break;
      case IS_CLAUSE_KIND:
        stripUnsupportedFields(value, path, ['kind', 'tribes'], context);
        clause = {
          kind,
          tribes: sanitizeTribeReferences(value['tribes'], fieldPath(path, 'tribes'), tribeIds, context)
        };
        break;
      case COUNT_CLAUSE_KIND:
        stripUnsupportedFields(value, path, ['kind', 'selector', 'interval'], context);
        clause = sanitizeIntervalClause(value, path, tribeIds, context);
        break;
      case NONE_CLAUSE_KIND:
        stripUnsupportedFields(value, path, ['kind', 'selector'], context);
        clause = {
          kind,
          selector: sanitizeOptionalSelector(value['selector'], fieldPath(path, 'selector'), tribeIds, context)
        };
        break;
      case EXACTLY_CLAUSE_KIND:
      case MIN_CLAUSE_KIND:
      case MAX_CLAUSE_KIND:
        stripUnsupportedFields(value, path, ['kind', 'selector', 'value'], context);
        clause = {
          kind,
          selector: sanitizeOptionalSelector(value['selector'], fieldPath(path, 'selector'), tribeIds, context),
          value: sanitizeNeighborCount(value['value'], fieldPath(path, 'value'), context)
        };
        break;
      case COMPARISON_CLAUSE_KIND:
        stripUnsupportedFields(value, path, [
          'kind',
          'left',
          'right',
          'operator',
          'margin'
        ], context);
        clause = sanitizeComparisonClause(value, path, tribeIds, context);
        break;
      case NOT_CLAUSE_KIND:
        stripUnsupportedFields(value, path, ['kind', 'clause'], context);
        if (value['clause'] === undefined) {
          addError(context, fieldPath(path, 'clause'), 'missing required clause');
        }
        clause = {
          kind,
          clause: sanitizeClause(value['clause'], fieldPath(path, 'clause'), tribeIds, context)
        };
        break;
      case AND_CLAUSE_KIND:
      case OR_CLAUSE_KIND:
      case XOR_CLAUSE_KIND:
        stripUnsupportedFields(value, path, ['kind', 'clauses'], context);
        clause = sanitizeLogicalClause(value, path, tribeIds, context);
        break;
      default:
        addError(context, fieldPath(path, 'kind'), 'unsupported clause kind');
        break;
    }
  } else {
    addError(context, path, 'expected clause object');
  }
  return clause;
}

/**
 * Sanitizes a count interval clause.
 *
 * @param {UnknownRecord} value raw clause object.
 * @param {string} path clause path.
 * @param {ReadonlySet<string>} tribeIds known tribe IDs.
 * @param {SanitizerContext} context sanitizer context.
 * @returns {unknown} sanitized clause.
 */
function sanitizeIntervalClause(value: UnknownRecord, path: string, tribeIds: ReadonlySet<string>, context: SanitizerContext): unknown {
  const interval: [number, number] = [0, 0];
  if (Array.isArray(value['interval']) && value['interval'].length === 2) {
    interval[0] = sanitizeNeighborCount(value['interval'][0], `${fieldPath(path, 'interval')}[0]`, context);
    interval[1] = sanitizeNeighborCount(value['interval'][1], `${fieldPath(path, 'interval')}[1]`, context);
    if (interval[0] > interval[1]) {
      addError(context, fieldPath(path, 'interval'), 'minimum count cannot be greater than maximum count');
    }
  } else {
    addError(context, fieldPath(path, 'interval'), 'expected [min, max] neighbor count interval');
  }
  return {
    kind: COUNT_CLAUSE_KIND,
    selector: sanitizeOptionalSelector(value['selector'], fieldPath(path, 'selector'), tribeIds, context),
    interval
  };
}

/**
 * Sanitizes a comparison clause.
 *
 * @param {UnknownRecord} value raw clause object.
 * @param {string} path clause path.
 * @param {ReadonlySet<string>} tribeIds known tribe IDs.
 * @param {SanitizerContext} context sanitizer context.
 * @returns {unknown} sanitized clause.
 */
function sanitizeComparisonClause(value: UnknownRecord, path: string, tribeIds: ReadonlySet<string>, context: SanitizerContext): unknown {
  let operator = '=';
  if (typeof value['operator'] === 'string' && OPERATORS.has(value['operator'])) {
    operator = value['operator'];
  } else {
    addError(context, fieldPath(path, 'operator'), 'expected supported comparison operator');
  }
  let margin: number | undefined;
  if (value['margin'] === undefined) {
    margin = undefined;
  } else if (isIntegerInRange(value['margin'], -8, 8)) {
    margin = value['margin'];
  } else {
    addError(context, fieldPath(path, 'margin'), 'expected integer from -8 to 8');
  }
  return {
    kind: COMPARISON_CLAUSE_KIND,
    left: sanitizeOptionalCountExpression(value['left'], fieldPath(path, 'left'), tribeIds, context),
    right: sanitizeOptionalCountExpression(value['right'], fieldPath(path, 'right'), tribeIds, context),
    operator,
    margin
  };
}

/**
 * Sanitizes a logical clause.
 *
 * @param {UnknownRecord} value raw clause object.
 * @param {string} path clause path.
 * @param {ReadonlySet<string>} tribeIds known tribe IDs.
 * @param {SanitizerContext} context sanitizer context.
 * @returns {unknown} sanitized clause.
 */
function sanitizeLogicalClause(value: UnknownRecord, path: string, tribeIds: ReadonlySet<string>, context: SanitizerContext): unknown {
  const clauses: unknown[] = [];
  if (Array.isArray(value['clauses'])) {
    for (let index = 0; index < value['clauses'].length; index++) {
      clauses.push(sanitizeClause(value['clauses'][index], indexPath(fieldPath(path, 'clauses'), index), tribeIds, context));
    }
    if (clauses.length < 2) {
      addError(context, fieldPath(path, 'clauses'), 'expected at least two child clauses');
    }
  } else {
    addError(context, fieldPath(path, 'clauses'), 'expected child clause array');
  }
  return {
    kind: value['kind'],
    clauses
  };
}

/**
 * Sanitizes a rule outcome expression.
 *
 * @param {unknown} value raw become value.
 * @param {string} path outcome path.
 * @param {ReadonlySet<string>} tribeIds known tribe IDs.
 * @param {SanitizerContext} context sanitizer context.
 * @returns {unknown} sanitized become expression.
 */
function sanitizeBecome(value: unknown, path: string, tribeIds: ReadonlySet<string>, context: SanitizerContext): unknown {
  let become: unknown = {kind: FIXED_BECOME_KIND, tribe: DEAD_TRIBE_ID};
  if (value === undefined) {
    become = {kind: FIXED_BECOME_KIND, tribe: DEAD_TRIBE_ID};
  } else if (isRecord(value)) {
    const {kind} = value;
    switch (kind) {
      case FIXED_BECOME_KIND:
        stripUnsupportedFields(value, path, ['kind', 'tribe'], context);
        become = {
          kind,
          tribe: sanitizeTribeReference(value['tribe'], fieldPath(path, 'tribe'), tribeIds, context)
        };
        break;
      case SAME_BECOME_KIND:
        stripUnsupportedFields(value, path, ['kind'], context);
        become = {kind};
        break;
      case MAJORITY_BECOME_KIND:
      case MINORITY_BECOME_KIND:
        stripUnsupportedFields(value, path, [
          'kind',
          'selector',
          'tie',
          'fallback'
        ], context);
        become = {
          kind,
          selector: sanitizeOptionalSelector(value['selector'], fieldPath(path, 'selector'), tribeIds, context),
          tie: value['tie'] === undefined ? undefined : sanitizeBecome(value['tie'], fieldPath(path, 'tie'), tribeIds, context),
          fallback: value['fallback'] === undefined ? undefined : sanitizeBecome(value['fallback'], fieldPath(path, 'fallback'), tribeIds, context)
        };
        break;
      case COMBINE_BECOME_KIND:
        stripUnsupportedFields(value, path, ['kind', 'entries', 'default'], context);
        become = {
          kind,
          entries: sanitizeCombinationEntries(value['entries'], fieldPath(path, 'entries'), tribeIds, context),
          default: value['default'] === undefined ? undefined : sanitizeBecome(value['default'], fieldPath(path, 'default'), tribeIds, context)
        };
        break;
      default:
        addError(context, fieldPath(path, 'kind'), 'unsupported Become kind');
        break;
    }
  } else {
    addError(context, path, 'expected Become object');
  }
  return become;
}

/**
 * Sanitizes one required tribe reference.
 *
 * @param {unknown} value raw tribe reference.
 * @param {string} path value path.
 * @param {ReadonlySet<string>} tribeIds known tribe IDs.
 * @param {SanitizerContext} context sanitizer context.
 * @returns {string} sanitized tribe reference.
 */
function sanitizeTribeReference(value: unknown, path: string, tribeIds: ReadonlySet<string>, context: SanitizerContext): string {
  let reference = DEAD_TRIBE_ID;
  if (typeof value === 'string' && tribeIds.has(value)) {
    reference = value;
  } else {
    addError(context, path, EXPECTED_KNOWN_TRIBE_ID_ERROR);
  }
  return reference;
}

/**
 * Sanitizes lookup combination entries.
 *
 * @param {unknown} value raw entries.
 * @param {string} path entries path.
 * @param {ReadonlySet<string>} tribeIds known tribe IDs.
 * @param {SanitizerContext} context sanitizer context.
 * @returns {unknown[]} sanitized entries.
 */
function sanitizeCombinationEntries(value: unknown, path: string, tribeIds: ReadonlySet<string>, context: SanitizerContext): unknown[] {
  const entries: unknown[] = [];
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index++) {
      entries.push(sanitizeCombinationEntry(value[index], indexPath(path, index), tribeIds, context));
    }
  } else {
    addError(context, path, 'expected combination entry array');
  }
  return entries;
}

/**
 * Sanitizes one lookup combination entry.
 *
 * @param {unknown} value raw entry.
 * @param {string} path entry path.
 * @param {ReadonlySet<string>} tribeIds known tribe IDs.
 * @param {SanitizerContext} context sanitizer context.
 * @returns {unknown} sanitized entry.
 */
function sanitizeCombinationEntry(value: unknown, path: string, tribeIds: ReadonlySet<string>, context: SanitizerContext): unknown {
  const entry: {inputs: unknown[]; output: string} = {inputs: [], output: DEAD_TRIBE_ID};
  if (isRecord(value)) {
    stripUnsupportedFields(value, path, ['inputs', 'output'], context);
    if (Array.isArray(value['inputs'])) {
      for (let index = 0; index < value['inputs'].length; index++) {
        entry.inputs.push(sanitizeSelector(value['inputs'][index], indexPath(fieldPath(path, 'inputs'), index), tribeIds, context));
      }
    } else {
      addError(context, fieldPath(path, 'inputs'), 'expected selector array');
    }
    entry.output = sanitizeTribeReference(value['output'], fieldPath(path, 'output'), tribeIds, context);
  } else {
    addError(context, path, 'expected combination entry object');
  }
  return entry;
}

/**
 * Sanitizes one rule.
 *
 * @param {unknown} value raw rule.
 * @param {string} path rule path.
 * @param {readonly Tribe[]} tribes known tribes.
 * @param {SanitizerContext} context sanitizer context.
 * @returns {unknown} sanitized rule.
 */
function sanitizeRule(value: unknown, path: string, tribes: readonly Tribe[], context: SanitizerContext): unknown {
  const tribeIds = new Set(tribes.map(tribe => tribe.id));
  const rule: {clause: unknown; become: unknown; probability?: number; muted?: boolean} = {
    clause: {kind: EMPTY_CLAUSE_KIND},
    become: sanitizeBecome(undefined, fieldPath(path, 'become'), tribeIds, context)
  };
  if (isRecord(value)) {
    stripUnsupportedFields(value, path, [
      'clause',
      'become',
      'probability',
      'muted'
    ], context);
    if (value['clause'] === undefined) {
      addError(context, fieldPath(path, 'clause'), 'missing required clause');
    }
    rule.clause = sanitizeClause(value['clause'], fieldPath(path, 'clause'), tribeIds, context);
    rule.become = sanitizeBecome(value['become'], fieldPath(path, 'become'), tribeIds, context);
    for (const issue of validateBecomeSemantics(rule.become as Become<Tribe[]>, tribes, fieldPath(path, 'become'))) {
      addError(context, issue.path, issue.message);
    }
    if (value['probability'] === undefined) {
      rule.probability = DEFAULT_RULE_PROBABILITY;
    } else if (typeof value['probability'] === 'number' && Number.isFinite(value['probability']) && value['probability'] >= MIN_RULE_PROBABILITY && value['probability'] <= MAX_RULE_PROBABILITY) {
      rule.probability = value['probability'];
    } else {
      addError(context, fieldPath(path, 'probability'), `expected number from ${MIN_RULE_PROBABILITY} to ${MAX_RULE_PROBABILITY}`);
    }
    if (value['muted'] === undefined) {
      rule.muted = false;
    } else if (typeof value['muted'] === 'boolean') {
      rule.muted = value['muted'];
    } else {
      addError(context, fieldPath(path, 'muted'), 'expected boolean');
    }
  } else {
    addError(context, path, 'expected rule object');
  }
  return rule;
}

/**
 * Sanitizes the rule list.
 *
 * @param {unknown} value raw rule list.
 * @param {readonly Tribe[]} tribes known tribes.
 * @param {SanitizerContext} context sanitizer context.
 * @returns {unknown[]} sanitized rules.
 */
function sanitizeRules(value: unknown, tribes: readonly Tribe[], context: SanitizerContext): unknown[] {
  const rules: unknown[] = [];
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index++) {
      rules.push(sanitizeRule(value[index], indexPath('rules', index), tribes, context));
    }
  } else if (value === undefined) {
    addError(context, 'rules', 'missing required rule list');
  } else {
    addError(context, 'rules', 'expected rule array');
  }
  return rules;
}

/**
 * Sanitizes topology metadata.
 *
 * @param {unknown} value raw topology value.
 * @param {SanitizerContext} context sanitizer context.
 * @returns {'toroidal' | 'bounded' | undefined} sanitized topology.
 */
function sanitizeTopology(value: unknown, context: SanitizerContext): typeof TOROIDAL_GRID_TOPOLOGY | typeof BOUNDED_GRID_TOPOLOGY | undefined {
  let topology: typeof TOROIDAL_GRID_TOPOLOGY | typeof BOUNDED_GRID_TOPOLOGY | undefined;
  if (value === undefined) {
    topology = undefined;
  } else if (typeof value === 'string' && GRID_TOPOLOGY_VALUES.includes(value as typeof GRID_TOPOLOGY_VALUES[number])) {
    topology = value as typeof TOROIDAL_GRID_TOPOLOGY | typeof BOUNDED_GRID_TOPOLOGY;
  } else {
    addError(context, 'topology', 'expected supported grid topology');
  }
  return topology;
}

/**
 * Sanitizes boundary tribe metadata.
 *
 * @param {unknown} value raw boundary tribe value.
 * @param {ReadonlySet<string>} tribeIds known tribe IDs.
 * @param {SanitizerContext} context sanitizer context.
 * @returns {string | undefined} sanitized boundary tribe.
 */
function sanitizeBoundaryTribe(value: unknown, tribeIds: ReadonlySet<string>, context: SanitizerContext): string | undefined {
  let boundaryTribe: string | undefined;
  if (value === undefined) {
    boundaryTribe = undefined;
  } else if (typeof value === 'string' && tribeIds.has(value)) {
    boundaryTribe = value;
  } else {
    addError(context, 'boundaryTribe', 'expected known tribe id');
  }
  return boundaryTribe;
}

/**
 * Sanitizes the parsed untrusted `.golt` JSON header.
 *
 * @param {unknown} value untrusted parsed JSON value.
 * @returns {GoltHeader} sanitized canonical header.
 */
export function sanitizeGoltHeader(value: unknown): GoltHeader {
  const context: SanitizerContext = {strippedFields: [], errors: []};
  const header: GoltHeader = {
    cols: 3,
    rows: 3,
    generation: 0,
    topology: TOROIDAL_GRID_TOPOLOGY,
    boundaryTribe: DEAD_TRIBE_ID,
    randomSeed: DEFAULT_RANDOM_SEED,
    gridFormat: {bitsPerCell: 8},
    tribes: [],
    rules: []
  };
  if (isRecord(value)) {
    stripUnsupportedFields(value, '', [
      'cols',
      'rows',
      'generation',
      'topology',
      'boundaryTribe',
      'randomSeed',
      'gridFormat',
      'tribes',
      'rules'
    ], context);
    const tribes = sanitizeTribes(value['tribes'], context);
    const tribeIds = new Set(tribes.map(tribe => tribe.id));
    header.cols = sanitizeRequiredInteger(value, 'cols', 3, Number.MAX_SAFE_INTEGER, '', context);
    header.rows = sanitizeRequiredInteger(value, 'rows', 3, Number.MAX_SAFE_INTEGER, '', context);
    header.generation = sanitizeOptionalInteger(value, 'generation', 0, Number.MAX_SAFE_INTEGER, context) ?? 0;
    header.topology = sanitizeTopology(value['topology'], context) ?? TOROIDAL_GRID_TOPOLOGY;
    header.boundaryTribe = sanitizeBoundaryTribe(value['boundaryTribe'], tribeIds, context) ?? DEAD_TRIBE_ID;
    header.randomSeed = sanitizeOptionalInteger(value, 'randomSeed', MIN_RANDOM_SEED, MAX_RANDOM_SEED, context) ?? DEFAULT_RANDOM_SEED;
    header.gridFormat = sanitizeGridFormat(value['gridFormat'], tribes.length, context);
    header.tribes = tribes;
    header.rules = sanitizeRules(value['rules'], tribes, context) as GoltHeader['rules'];
  } else {
    addError(context, '', 'expected snapshot header object');
  }
  if (context.strippedFields.length > 0) {
    console.warn('[GOLT] Ignoring unsupported snapshot fields', context.strippedFields);
  }
  if (context.errors.length > 0) {
    console.error('[GOLT] Invalid snapshot payload', context.errors);
    throw new Error(INVALID_SNAPSHOT_PAYLOAD_MESSAGE);
  }
  return header;
}
