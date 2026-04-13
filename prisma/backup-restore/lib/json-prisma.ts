/** JSON markers for values that are not native JSON types (unambiguous round-trip). */
const DATE = '__prismaDate';
const DECIMAL = '__prismaDecimal';
const BIGINT = '__prismaBigInt';
const BYTES = '__prismaBytes';

function isPrismaDecimalLike(value: unknown): value is { toFixed: () => string } {
  if (!value || typeof value !== 'object') return false;
  const ctor = (value as { constructor?: { name?: string } }).constructor?.name;
  if (ctor !== 'Decimal') return false;
  const tf = (value as { toFixed?: unknown }).toFixed;
  return typeof tf === 'function';
}

export function prismaJsonReplacer(_key: string, value: unknown): unknown {
  if (value instanceof Date) {
    return { [DATE]: value.toISOString() };
  }
  if (typeof value === 'bigint') {
    return { [BIGINT]: value.toString() };
  }
  if (isPrismaDecimalLike(value)) {
    return { [DECIMAL]: value.toFixed() };
  }
  if (Buffer.isBuffer(value)) {
    return { [BYTES]: value.toString('base64') };
  }
  return value;
}

function reviveMarked(_key: string, value: unknown): unknown {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return value;
  const o = value as Record<string, unknown>;
  const keys = Object.keys(o);
  if (keys.length !== 1) return value;
  const k = keys[0];
  const v = o[k];
  if (typeof v !== 'string') return value;
  if (k === DATE) return new Date(v);
  if (k === DECIMAL) return v;
  if (k === BIGINT) return BigInt(v);
  if (k === BYTES) return Buffer.from(v, 'base64');
  return value;
}

export function stringifyBackupPayload(data: object): string {
  return JSON.stringify(data, prismaJsonReplacer, 2);
}

export function parseBackupJson(raw: string): unknown {
  return JSON.parse(raw, reviveMarked);
}
