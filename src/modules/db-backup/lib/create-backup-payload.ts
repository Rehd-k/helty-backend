import { Prisma } from '@prisma/client';

type DmmfModel = {
  name: string;
  isView?: boolean;
};

type FindManyDelegate = {
  findMany: (args?: Record<string, never>) => Promise<Record<string, unknown>[]>;
};

function modelNameToDelegateKey(modelName: string): string {
  if (!modelName) return modelName;
  return modelName.charAt(0).toLowerCase() + modelName.slice(1);
}

function loadDatamodelModels(): DmmfModel[] {
  const embedded = Prisma.dmmf?.datamodel as unknown as
    | { models?: DmmfModel[] }
    | undefined;
  if (!embedded?.models?.length) {
    throw new Error(
      'Prisma DMMF is empty. Run `npx prisma generate` before backup.',
    );
  }
  return embedded.models;
}

function filterWritableModels(prisma: object): DmmfModel[] {
  const out: DmmfModel[] = [];
  for (const m of loadDatamodelModels()) {
    if (m.isView) continue;
    const key = modelNameToDelegateKey(m.name);
    const delegate = (prisma as Record<string, { findMany?: unknown }>)[key];
    if (delegate && typeof delegate.findMany === 'function') {
      out.push(m);
    }
  }
  return out;
}

function isPrismaP2022(err: unknown): err is { code: string; message: string } {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: string }).code === 'P2022' &&
    'message' in err &&
    typeof (err as { message: unknown }).message === 'string'
  );
}

export type BackupPayloadResult = {
  payload: Record<string, unknown>;
  rowCounts: Record<string, number>;
  totalRows: number;
};

/**
 * Full logical backup of all writable Prisma models (scalar + enum fields via findMany).
 */
export async function createBackupPayload(
  prisma: object,
  options?: { skipSchemaMismatch?: boolean },
): Promise<BackupPayloadResult> {
  const models = filterWritableModels(prisma);
  const payload: Record<string, unknown> = {};
  const rowCounts: Record<string, number> = {};
  const skippedSchemaMismatch: { model: string; code: string; message: string }[] =
    [];
  const skipMismatch =
    options?.skipSchemaMismatch === true ||
    process.env.BACKUP_SKIP_SCHEMA_MISMATCH === '1';

  for (const m of models) {
    const key = modelNameToDelegateKey(m.name);
    const delegate = (prisma as Record<string, FindManyDelegate>)[key];
    if (!delegate?.findMany) {
      continue;
    }
    try {
      const rows = await delegate.findMany();
      payload[m.name] = rows;
      rowCounts[m.name] = rows.length;
    } catch (err) {
      if (isPrismaP2022(err)) {
        const hint =
          `Database schema is out of sync with prisma/schema.prisma (model "${m.name}"). ` +
          `On this machine run: npx prisma migrate deploy (same DATABASE_URL you use for the app)`;
        if (skipMismatch) {
          skippedSchemaMismatch.push({
            model: m.name,
            code: err.code,
            message: err.message,
          });
          payload[m.name] = [];
          rowCounts[m.name] = 0;
          continue;
        }
        throw new Error(`${hint}\n\nUnderlying error: ${err.message}`);
      }
      throw err;
    }
  }

  payload._meta = {
    version: 1,
    createdAt: new Date().toISOString(),
    rowCounts,
    ...(skippedSchemaMismatch.length > 0 ? { skippedSchemaMismatch } : {}),
  };

  const totalRows = Object.values(rowCounts).reduce((a, b) => a + b, 0);
  return { payload, rowCounts, totalRows };
}
