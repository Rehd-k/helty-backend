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

export function stringifyBackupPayload(data: object): string {
  return JSON.stringify(data, prismaJsonReplacer, 2);
}
