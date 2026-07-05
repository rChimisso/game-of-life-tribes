import {NumberInputConstraints, NumberInputEditResult, NumberInputValidation} from '../model/number-input';

/**
 * Builds a prospective input value from a replacement edit.
 *
 * @param {string} value current value.
 * @param {number} start selection start.
 * @param {number} end selection end.
 * @param {string} replacement replacement text.
 * @returns {string} prospective value.
 */
function prospectiveNumberView(value: string, start: number, end: number, replacement: string): string {
  return `${value.slice(0, start)}${replacement}${value.slice(end)}`;
}

/**
 * Normalizes and classifies a numeric input view value.
 *
 * @param {string} rawValue raw view value.
 * @param {NumberInputConstraints} constraints numeric constraints.
 * @returns {NumberInputEditResult} edit result.
 */
function normalizeNumberEdit(rawValue: string, constraints: NumberInputConstraints): NumberInputEditResult {
  const separator = constraints.decimalSeparator;
  let viewValue = rawValue.replace(/[.,]/g, separator);
  let accepted = true;
  let modelValue: number | null = null;
  if (viewValue === '') {
    modelValue = null;
  } else if (viewValue === '-' && negativesAllowed(constraints)) {
    modelValue = null;
  } else {
    viewValue = normalizeDecimalPrefix(rawValue, viewValue, constraints);
    accepted = hasValidStructure(viewValue, constraints);
    if (accepted) {
      viewValue = normalizeLeadingZeroes(viewValue, separator);
      accepted = hasValidStructure(viewValue, constraints);
    }
    if (accepted) {
      modelValue = parseViewNumber(viewValue, separator);
    }
  }
  return {
    accepted,
    viewValue,
    modelValue
  };
}

/**
 * Normalizes decimal-prefix shorthand.
 *
 * @param {string} rawValue raw view value.
 * @param {string} viewValue separator-normalized view value.
 * @param {NumberInputConstraints} constraints numeric constraints.
 * @returns {string} normalized view value.
 */
function normalizeDecimalPrefix(rawValue: string, viewValue: string, constraints: NumberInputConstraints): string {
  const separator = constraints.decimalSeparator;
  let normalizedViewValue = viewValue;
  if ((rawValue === '.' || rawValue === ',') && decimalsAllowed(constraints)) {
    normalizedViewValue = `0${separator}`;
  } else if ((rawValue === '-.' || rawValue === '-,') && negativesAllowed(constraints) && decimalsAllowed(constraints)) {
    normalizedViewValue = `-0${separator}`;
  } else if (viewValue.startsWith(separator) && decimalsAllowed(constraints)) {
    normalizedViewValue = `0${viewValue}`;
  } else if (viewValue.startsWith(`-${separator}`) && negativesAllowed(constraints) && decimalsAllowed(constraints)) {
    normalizedViewValue = `-0${viewValue.slice(1)}`;
  }
  return normalizedViewValue;
}

/**
 * Formats a model value for the input view.
 *
 * @param {(number | null)} value model value.
 * @param {'.' | ','} separator decimal separator.
 * @returns {string} view value.
 */
function formatNumberView(value: number | null, separator: '.' | ','): string {
  let viewValue = '';
  if (value !== null && Number.isFinite(value)) {
    const normalizedValue = Object.is(value, -0) ? 0 : value;
    const sign = normalizedValue < 0 ? '-' : '';
    const {integerPart, decimalPart} = decimalParts(normalizedValue);
    viewValue = decimalPart ? `${sign}${integerPart}${separator}${decimalPart}` : `${sign}${integerPart}`;
  }
  return viewValue;
}

/**
 * Normalizes a numeric view on blur.
 *
 * @param {string} viewValue current view value.
 * @param {NumberInputConstraints} constraints numeric constraints.
 * @returns {NumberInputEditResult} edit result.
 */
function normalizeNumberBlur(viewValue: string, constraints: NumberInputConstraints): NumberInputEditResult {
  const result = normalizeNumberEdit(viewValue, constraints);
  let normalizedView = result.viewValue;
  let normalizedModel = result.modelValue;
  if (result.accepted && normalizedView !== '' && normalizedView !== '-') {
    normalizedView = formatNumberView(normalizedModel, constraints.decimalSeparator);
    normalizedModel = parseViewNumber(normalizedView, constraints.decimalSeparator);
  } else if (normalizedView === '-') {
    normalizedView = '';
    normalizedModel = null;
  }
  return {
    accepted: result.accepted,
    viewValue: normalizedView,
    modelValue: normalizedModel
  };
}

/**
 * Counts digits relevant to numeric validation.
 *
 * @param {(number | null)} value model value.
 * @returns {NumberInputValidation} validation metadata.
 */
function numberValidationMetadata(value: number | null): NumberInputValidation {
  let integerDigits = 0;
  let decimalDigits = 0;
  if (value !== null && Number.isFinite(value)) {
    const {integerPart, decimalPart} = decimalParts(value);
    integerDigits = integerPart.length;
    decimalDigits = decimalPart.length;
  }
  return {
    integerDigits,
    decimalDigits
  };
}

/**
 * Converts a finite number into plain decimal parts for digit counting.
 *
 * @param {number} value finite numeric value.
 * @returns {{integerPart: string; decimalPart: string}} decimal parts.
 */
function decimalParts(value: number): {integerPart: string; decimalPart: string} {
  const absoluteLabel = Math.abs(value).toString();
  const match = /^(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?$/i.exec(absoluteLabel);
  let integerPart = '0';
  let decimalPart = '';
  if (match) {
    const coefficientInteger = match[1] ?? '0';
    const coefficientDecimal = match[2] ?? '';
    const exponent = Number(match[3] ?? 0);
    const digits = `${coefficientInteger}${coefficientDecimal}`;
    const decimalIndex = coefficientInteger.length + exponent;
    if (decimalIndex <= 0) {
      integerPart = '0';
      decimalPart = `${'0'.repeat(Math.abs(decimalIndex))}${digits}`.replace(/0+$/, '');
    } else if (decimalIndex >= digits.length) {
      integerPart = `${digits}${'0'.repeat(decimalIndex - digits.length)}`.replace(/^0+(?=\d)/, '');
      decimalPart = '';
    } else {
      integerPart = digits.slice(0, decimalIndex).replace(/^0+(?=\d)/, '');
      decimalPart = digits.slice(decimalIndex).replace(/0+$/, '');
    }
  }
  return {
    integerPart: integerPart === '' ? '0' : integerPart,
    decimalPart
  };
}

/**
 * Checks whether negative syntax is allowed.
 *
 * @param {NumberInputConstraints} constraints numeric constraints.
 * @returns {boolean} whether negative syntax is allowed.
 */
function negativesAllowed(constraints: NumberInputConstraints): boolean {
  return constraints.min === undefined || constraints.min < 0;
}

/**
 * Checks whether decimal syntax is allowed.
 *
 * @param {NumberInputConstraints} constraints numeric constraints.
 * @returns {boolean} whether decimal syntax is allowed.
 */
function decimalsAllowed(constraints: NumberInputConstraints): boolean {
  return constraints.decimalDigits > 0;
}

/**
 * Checks complete view syntax.
 *
 * @param {string} viewValue view value.
 * @param {NumberInputConstraints} constraints numeric constraints.
 * @returns {boolean} whether the view syntax is valid.
 */
function hasValidStructure(viewValue: string, constraints: NumberInputConstraints): boolean {
  const separator = constraints.decimalSeparator;
  const separatorCount = [...viewValue].filter(character => character === separator).length;
  const minusCount = [...viewValue].filter(character => character === '-').length;
  const hasSeparator = separatorCount > 0;
  let valid = true;
  if (minusCount > 1 || (minusCount === 1 && !viewValue.startsWith('-')) || (minusCount === 1 && !negativesAllowed(constraints))) {
    valid = false;
  } else if (separatorCount > 1 || (hasSeparator && !decimalsAllowed(constraints))) {
    valid = false;
  } else {
    const unsignedValue = viewValue.startsWith('-') ? viewValue.slice(1) : viewValue;
    const [integerPart = '', decimalPart = ''] = unsignedValue.split(separator);
    const decimalValid = decimalPart.length <= constraints.decimalDigits;
    const integerValid = /^[0-9]+$/.test(integerPart);
    const decimalCharactersValid = /^[0-9]*$/.test(decimalPart);
    valid = integerValid && decimalValid && decimalCharactersValid;
    if (valid && constraints.maxIntegerDigits !== undefined) {
      valid = normalizeIntegerPart(integerPart).length <= constraints.maxIntegerDigits;
    }
  }
  return valid;
}

/**
 * Normalizes redundant integer leading zeroes.
 *
 * @param {string} viewValue view value.
 * @param {'.' | ','} separator decimal separator.
 * @returns {string} normalized view value.
 */
function normalizeLeadingZeroes(viewValue: string, separator: '.' | ','): string {
  const negative = viewValue.startsWith('-');
  const unsignedValue = negative ? viewValue.slice(1) : viewValue;
  const separatorIndex = unsignedValue.indexOf(separator);
  const hasSeparator = separatorIndex >= 0;
  const integerPart = hasSeparator ? unsignedValue.slice(0, separatorIndex) : unsignedValue;
  const decimalPart = hasSeparator ? unsignedValue.slice(separatorIndex + 1) : '';
  const normalizedIntegerPart = normalizeIntegerPart(integerPart);
  const sign = negative ? '-' : '';
  return hasSeparator ? `${sign}${normalizedIntegerPart}${separator}${decimalPart}` : `${sign}${normalizedIntegerPart}`;
}

/**
 * Normalizes integer-part leading zeroes.
 *
 * @param {string} integerPart integer part.
 * @returns {string} normalized integer part.
 */
function normalizeIntegerPart(integerPart: string): string {
  const normalized = integerPart.replace(/^0+(?=\d)/, '');
  return normalized === '' ? '0' : normalized;
}

/**
 * Parses a normalized view value.
 *
 * @param {string} viewValue normalized view value.
 * @param {'.' | ','} separator decimal separator.
 * @returns {(number | null)} model value.
 */
function parseViewNumber(viewValue: string, separator: '.' | ','): number | null {
  let value: number | null = null;
  if (viewValue !== '' && viewValue !== '-') {
    const parsed = Number(viewValue.replace(separator, '.'));
    value = Number.isFinite(parsed) ? parsed : null;
    if (Object.is(value, -0)) {
      value = 0;
    }
  }
  return value;
}

export {formatNumberView, normalizeNumberBlur, normalizeNumberEdit, numberValidationMetadata, prospectiveNumberView};
