import { LabAbnormalFlag, LabTestFieldType } from '@prisma/client';

export type ReferenceRangeFlag = 'LOW' | 'HIGH';

export type ParsedReferenceRange =
  | { kind: 'interval'; min: number; max: number }
  | { kind: 'lt'; limit: number }
  | { kind: 'lte'; limit: number }
  | { kind: 'gt'; limit: number }
  | { kind: 'gte'; limit: number };

export type ReferenceRangeEvaluation = {
  inRange: boolean | null;
  flag: ReferenceRangeFlag | null;
  parsedValue: number | null;
  referenceRange: string | null;
};

/** Normalize unicode dashes and comparison symbols for parsing. */
function normalizeReferenceRangeText(raw: string): string {
  return raw
    .trim()
    .replace(/\u2013|\u2014/g, '-') // en-dash, em-dash → hyphen
    .replace(/≤/g, '<=')
    .replace(/≥/g, '>=');
}

/** Extract leading numeric token from a result value (e.g. "1.3 mg/dL" → 1.3). */
export function parseNumericResultValue(value: string | null | undefined): number | null {
  if (value == null) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^([+-]?(?:\d+\.?\d*|\.\d+))/);
  if (!match) return null;
  const n = Number.parseFloat(match[1]);
  return Number.isFinite(n) ? n : null;
}

/**
 * Parse a reference range string into a structured rule.
 * Returns null when the text is empty or not recognized.
 */
export function parseReferenceRange(
  referenceRange: string | null | undefined,
): ParsedReferenceRange | null {
  if (referenceRange == null) return null;
  const text = normalizeReferenceRangeText(referenceRange);
  if (!text) return null;

  const thresholdMatch = text.match(/^(<=|>=|<|>)\s*([+-]?(?:\d+\.?\d*|\.\d+))$/);
  if (thresholdMatch) {
    const op = thresholdMatch[1];
    const limit = Number.parseFloat(thresholdMatch[2]);
    if (!Number.isFinite(limit)) return null;
    switch (op) {
      case '<':
        return { kind: 'lt', limit };
      case '<=':
        return { kind: 'lte', limit };
      case '>':
        return { kind: 'gt', limit };
      case '>=':
        return { kind: 'gte', limit };
    }
  }

  const intervalMatch = text.match(
    /^([+-]?(?:\d+\.?\d*|\.\d+))\s*-\s*([+-]?(?:\d+\.?\d*|\.\d+))$/,
  );
  if (intervalMatch) {
    const min = Number.parseFloat(intervalMatch[1]);
    const max = Number.parseFloat(intervalMatch[2]);
    if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
    if (min > max) return null;
    return { kind: 'interval', min, max };
  }

  return null;
}

/** True when referenceRange is non-empty and parseable. */
export function isValidReferenceRange(
  referenceRange: string | null | undefined,
): boolean {
  if (referenceRange == null || !referenceRange.trim()) return true;
  return parseReferenceRange(referenceRange) !== null;
}

function evaluateParsedRange(
  parsed: ParsedReferenceRange,
  value: number,
): { inRange: boolean; flag: ReferenceRangeFlag | null } {
  switch (parsed.kind) {
    case 'interval': {
      if (value < parsed.min) return { inRange: false, flag: 'LOW' };
      if (value > parsed.max) return { inRange: false, flag: 'HIGH' };
      return { inRange: true, flag: null };
    }
    case 'lt': {
      if (value < parsed.limit) return { inRange: true, flag: null };
      return { inRange: false, flag: 'HIGH' };
    }
    case 'lte': {
      if (value <= parsed.limit) return { inRange: true, flag: null };
      return { inRange: false, flag: 'HIGH' };
    }
    case 'gt': {
      if (value > parsed.limit) return { inRange: true, flag: null };
      return { inRange: false, flag: 'LOW' };
    }
    case 'gte': {
      if (value >= parsed.limit) return { inRange: true, flag: null };
      return { inRange: false, flag: 'LOW' };
    }
  }
}

/**
 * Evaluate a lab result value against a field's reference range.
 * Only NUMBER fields with a parseable referenceRange are evaluated.
 */
export function evaluateReferenceRange(
  value: string | null | undefined,
  referenceRange: string | null | undefined,
  fieldType: LabTestFieldType,
): ReferenceRangeEvaluation {
  const rangeText =
    referenceRange != null && referenceRange.trim() ? referenceRange.trim() : null;

  if (fieldType !== LabTestFieldType.NUMBER || !rangeText) {
    return {
      inRange: null,
      flag: null,
      parsedValue: null,
      referenceRange: rangeText,
    };
  }

  const parsed = parseReferenceRange(rangeText);
  if (!parsed) {
    return {
      inRange: null,
      flag: null,
      parsedValue: null,
      referenceRange: rangeText,
    };
  }

  const numericValue = parseNumericResultValue(value);
  if (numericValue === null) {
    return {
      inRange: null,
      flag: null,
      parsedValue: null,
      referenceRange: rangeText,
    };
  }

  const { inRange, flag } = evaluateParsedRange(parsed, numericValue);
  return {
    inRange,
    flag,
    parsedValue: numericValue,
    referenceRange: rangeText,
  };
}

/** Values beyond reference by this fraction are flagged critical (20%). */
export const LAB_CRITICAL_MARGIN = 0.2;

function isValueCritical(
  parsed: ParsedReferenceRange,
  value: number,
  flag: ReferenceRangeFlag,
): boolean {
  const margin = LAB_CRITICAL_MARGIN;
  switch (parsed.kind) {
    case 'interval': {
      const span = parsed.max - parsed.min;
      if (span <= 0) return false;
      if (flag === 'LOW') {
        return value <= parsed.min - span * margin;
      }
      return value >= parsed.max + span * margin;
    }
    case 'lt':
    case 'lte':
      if (flag === 'HIGH') {
        return value >= parsed.limit * (1 + margin);
      }
      return false;
    case 'gt':
    case 'gte':
      if (flag === 'LOW') {
        return value <= parsed.limit * (1 - margin);
      }
      return false;
  }
}

export type LabResultPersistedFlags = {
  abnormalFlag: LabAbnormalFlag | null;
  isCritical: boolean;
  evaluatedAt: Date;
};

/** Flags to persist on LabResult from field metadata and value. */
export function computeLabResultFlags(
  value: string | null | undefined,
  referenceRange: string | null | undefined,
  fieldType: LabTestFieldType,
): LabResultPersistedFlags {
  const evaluation = evaluateReferenceRange(
    value,
    referenceRange,
    fieldType,
  );
  const evaluatedAt = new Date();
  if (!evaluation.flag) {
    return { abnormalFlag: null, isCritical: false, evaluatedAt };
  }
  const abnormalFlag = evaluation.flag as LabAbnormalFlag;
  let isCritical = false;
  if (evaluation.parsedValue !== null && evaluation.referenceRange) {
    const parsed = parseReferenceRange(evaluation.referenceRange);
    if (parsed) {
      isCritical = isValueCritical(parsed, evaluation.parsedValue, evaluation.flag);
    }
  }
  return { abnormalFlag, isCritical, evaluatedAt };
}
