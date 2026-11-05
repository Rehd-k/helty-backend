const WRITE_OPS = new Set([
  'create',
  'createMany',
  'createManyAndReturn',
  'update',
  'updateMany',
  'updateManyAndReturn',
  'upsert',
  'delete',
  'deleteMany',
]);

const SKIP_MODELS = new Set(['AuditLog', 'AuditTrail']);

const MAX_JSON_CHARS = 8000;
const MAX_DEPTH = 6;
const MAX_ARRAY = 40;
const MAX_FIELDS = 12;

export type TrailAction =
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'ADMINISTER'
  | 'MISSED'
  | 'REFUSED';

export type StaffWriteEvent = {
  model?: string;
  operation: string;
  args: unknown;
  result: unknown;
};

export type StaffWriteDescription = {
  action: string;
  entity: string;
  entityId: string;
  summary: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  admissionId?: string;
  trailAction?: TrailAction;
};

export function shouldCapture(
  model: string | undefined,
  operation: string,
): boolean {
  return !!model && !SKIP_MODELS.has(model) && WRITE_OPS.has(operation);
}

export function describeStaffWrite(
  event: StaffWriteEvent,
): StaffWriteDescription | null {
  if (!shouldCapture(event.model, event.operation)) return null;
  const model = event.model as string;
  const action = actionFor(event.operation);
  const entityId = resolveEntityId(event.operation, event.args, event.result);
  const fields = fieldNames(readData(event.args));
  const summary = buildSummary(action, model, entityId, fields);
  const isDelete = action === 'DELETE';
  const oldValue = isDelete
    ? capJson(deleteSnapshot(event.operation, event.args, event.result))
    : undefined;
  const newValue = isDelete
    ? undefined
    : capJson(readData(event.args) ?? event.result);
  const admissionId =
    model === 'Admission' && action === 'DELETE'
      ? undefined
      : resolveAdmissionId(model, event.args, event.result);
  const trailAction =
    admissionId && !entityId.startsWith('batch')
      ? trailActionFor(model, action, event.args, event.result)
      : undefined;
  return {
    action,
    entity: model,
    entityId,
    summary,
    oldValue,
    newValue,
    admissionId: trailAction ? admissionId : undefined,
    trailAction,
  };
}

export function buildLoginAudit(input: {
  success: boolean;
  identifier?: string;
  staff?: {
    id: string;
    staffId?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    staffRole?: string | null;
    accountType?: string | null;
    department?: { name?: string | null } | null;
  };
  meta?: { method?: string; route?: string; ip?: string };
}): {
  entity: string;
  entityId: string;
  action: string;
  summary: string;
  httpMethod?: string;
  route?: string;
  ipAddress?: string;
  staffRole?: string;
  accountType?: string;
  departmentName?: string;
  performedById?: string;
  newValue: Record<string, unknown>;
} {
  const identifier = (input.identifier ?? '').trim().slice(0, 120);
  if (!input.success || !input.staff) {
    return {
      entity: 'Auth',
      entityId: 'login',
      action: 'LOGIN_FAILED',
      summary: identifier ? `LOGIN_FAILED · ${identifier}` : 'LOGIN_FAILED',
      httpMethod: input.meta?.method,
      route: input.meta?.route,
      ipAddress: input.meta?.ip,
      newValue: identifier ? { identifier } : {},
    };
  }
  const name = [input.staff.firstName, input.staff.lastName]
    .filter((part) => !!part && part.trim())
    .join(' ')
    .trim();
  const code = input.staff.staffId?.trim();
  const who = [name, code ? `(${code})` : ''].filter(Boolean).join(' ');
  return {
    entity: 'Auth',
    entityId: input.staff.id,
    action: 'LOGIN',
    summary: who ? `LOGIN · ${who}` : 'LOGIN',
    httpMethod: input.meta?.method,
    route: input.meta?.route,
    ipAddress: input.meta?.ip,
    staffRole: input.staff.staffRole ?? undefined,
    accountType: input.staff.accountType ?? undefined,
    departmentName: input.staff.department?.name ?? undefined,
    performedById: input.staff.id,
    newValue: {
      staffId: input.staff.staffId ?? null,
      staffRole: input.staff.staffRole ?? null,
      accountType: input.staff.accountType ?? null,
    },
  };
}

function actionFor(operation: string): string {
  switch (operation) {
    case 'create':
    case 'createMany':
    case 'createManyAndReturn':
      return 'CREATE';
    case 'delete':
    case 'deleteMany':
      return 'DELETE';
    case 'upsert':
      return 'UPSERT';
    default:
      return 'UPDATE';
  }
}

function trailActionFor(
  model: string,
  action: string,
  args: unknown,
  result: unknown,
): TrailAction {
  if (model === 'MedicationAdministration' && action !== 'DELETE') {
    const status = readStatus(args, result);
    if (status === 'GIVEN') return 'ADMINISTER';
    if (status === 'MISSED') return 'MISSED';
    if (status === 'REFUSED') return 'REFUSED';
  }
  if (action === 'CREATE') return 'CREATE';
  if (action === 'DELETE') return 'DELETE';
  return 'UPDATE';
}

function readStatus(args: unknown, result: unknown): string | undefined {
  if (isRecord(result) && typeof result.status === 'string')
    return result.status;
  const data = readData(args);
  if (isRecord(data) && typeof data.status === 'string') return data.status;
  return undefined;
}

function resolveEntityId(
  operation: string,
  args: unknown,
  result: unknown,
): string {
  const fromResult = readId(result);
  if (fromResult) return fromResult;
  const where = isRecord(args) ? args.where : undefined;
  const whereId = readId(where) ?? readWhereEqualsId(where);
  if (whereId) return whereId;
  if (Array.isArray(result)) return `batch:${result.length}`;
  if (isRecord(result) && typeof result.count === 'number') {
    return `batch:${result.count}`;
  }
  if (operation.endsWith('Many')) return 'batch';
  return 'batch';
}

function resolveAdmissionId(
  model: string,
  args: unknown,
  result: unknown,
): string | undefined {
  if (Array.isArray(result)) return undefined;
  if (model === 'Admission') {
    return (
      readId(result) ??
      readWhereEqualsId(isRecord(args) ? args.where : undefined)
    );
  }
  if (isRecord(result) && typeof result.admissionId === 'string') {
    return result.admissionId;
  }
  const data = readData(args);
  if (isRecord(data)) {
    if (typeof data.admissionId === 'string') return data.admissionId;
    const connect = isRecord(data.admission)
      ? data.admission.connect
      : undefined;
    if (isRecord(connect) && typeof connect.id === 'string') return connect.id;
  }
  const where = isRecord(args) ? args.where : undefined;
  if (isRecord(where) && typeof where.admissionId === 'string') {
    return where.admissionId;
  }
  return undefined;
}

function deleteSnapshot(
  operation: string,
  args: unknown,
  result: unknown,
): unknown {
  if (operation === 'delete') return result;
  const where = isRecord(args) ? args.where : undefined;
  const count = isRecord(result) ? result.count : undefined;
  return { count: count ?? null, where: where ?? null };
}

function buildSummary(
  action: string,
  model: string,
  entityId: string,
  fields: string[],
): string {
  const fieldPart = fields.length ? ` · fields: ${fields.join(', ')}` : '';
  if (entityId.startsWith('batch')) {
    const count = entityId.slice('batch:'.length);
    const rows = count ? `${count} rows` : 'many rows';
    return `${action} ${model} · ${rows}${fieldPart}`.slice(0, 500);
  }
  return `${action} ${model}${fieldPart}`.slice(0, 500);
}

function fieldNames(data: unknown): string[] {
  if (Array.isArray(data)) {
    const first = data.find((item) => isRecord(item));
    return first ? fieldNames(first) : [];
  }
  if (!isRecord(data)) return [];
  return Object.keys(data)
    .filter((key) => !isSecretKey(key))
    .slice(0, MAX_FIELDS);
}

function readData(args: unknown): unknown {
  if (!isRecord(args)) return undefined;
  return args.data;
}

function readId(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined;
  return typeof value.id === 'string' && value.id.length > 0
    ? value.id
    : undefined;
}

function readWhereEqualsId(where: unknown): string | undefined {
  if (!isRecord(where) || !isRecord(where.id)) return undefined;
  return typeof where.id.equals === 'string' ? where.id.equals : undefined;
}

export function capJson(value: unknown): Record<string, unknown> | undefined {
  if (value == null) return undefined;
  const redacted = redactValue(value, 0);
  const text = JSON.stringify(redacted);
  if (text == null) return undefined;
  if (text.length <= MAX_JSON_CHARS) {
    if (isRecord(redacted)) return redacted;
    return { value: redacted as never };
  }
  return { truncated: true, preview: text.slice(0, 4000) };
}

function redactValue(value: unknown, depth: number): unknown {
  if (value == null) return value;
  if (depth > MAX_DEPTH) return '[max-depth]';
  if (
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }
  if (typeof value === 'bigint') return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_ARRAY)
      .map((item) => redactValue(item, depth + 1));
  }
  if (typeof value === 'object') {
    const named = value as {
      constructor?: { name?: string };
      toString?: () => string;
    };
    if (
      named.constructor?.name === 'Decimal' &&
      typeof named.toString === 'function'
    ) {
      return named.toString();
    }
    const out: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(
      value as Record<string, unknown>,
    )) {
      if (child === undefined) continue;
      out[key] = isSecretKey(key)
        ? '[redacted]'
        : redactValue(child, depth + 1);
    }
    return out;
  }
  return '[unserializable]';
}

function isSecretKey(key: string): boolean {
  const k = key.toLowerCase();
  return (
    k.includes('password') ||
    k.includes('token') ||
    k.includes('secret') ||
    k === 'otp' ||
    k.endsWith('otp') ||
    k === 'pin' ||
    k.includes('authorization') ||
    k.includes('credential')
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}
