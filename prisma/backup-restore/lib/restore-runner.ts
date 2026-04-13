import type { PrismaClient } from '@prisma/client';
import type { DmmfModel } from './dmmf-models';
import { getScalarFieldNames, getPrimaryKeyFieldNames, modelNameToDelegateKey } from './dmmf-models';

export type RestoreFailure = {
  model: string;
  batchIndex: number;
  rowIndex?: number;
  message: string;
  record?: Record<string, unknown>;
};

export type RestoreSummary = {
  insertedByModel: Record<string, number>;
  failures: RestoreFailure[];
};

type ModelDelegate = {
  createMany: (args: { data: Record<string, unknown>[] }) => Promise<{ count: number }>;
  create: (args: { data: Record<string, unknown> }) => Promise<unknown>;
};

function getDelegate(prisma: PrismaClient, modelName: string): ModelDelegate | null {
  const key = modelNameToDelegateKey(modelName);
  const d = (prisma as unknown as Record<string, unknown>)[key];
  if (
    d &&
    typeof (d as ModelDelegate).createMany === 'function' &&
    typeof (d as ModelDelegate).create === 'function'
  ) {
    return d as ModelDelegate;
  }
  return null;
}

function scalarSet(model: DmmfModel): Set<string> {
  return new Set(getScalarFieldNames(model));
}

/** Keep only scalar/enum columns Prisma expects on create; drop undefined. */
export function sanitizeRowForCreate(
  row: Record<string, unknown>,
  model: DmmfModel,
): Record<string, unknown> {
  const allowed = scalarSet(model);
  const out: Record<string, unknown> = {};
  for (const key of allowed) {
    if (!Object.prototype.hasOwnProperty.call(row, key)) continue;
    const v = row[key];
    if (v !== undefined) out[key] = v;
  }
  return out;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Inserts backup rows in dependency order using batched `createMany`, with optional
 * per-row `create` fallback when `continueOnError` is true.
 */
export async function runBatchedRestore(params: {
  prisma: PrismaClient;
  modelsByName: Map<string, DmmfModel>;
  insertOrder: string[];
  backupTables: Record<string, unknown[]>;
  batchSize: number;
  continueOnError: boolean;
}): Promise<RestoreSummary> {
  const { prisma, modelsByName, insertOrder, backupTables, batchSize, continueOnError } = params;
  const insertedByModel: Record<string, number> = {};
  const failures: RestoreFailure[] = [];

  for (const modelName of insertOrder) {
    const model = modelsByName.get(modelName);
    if (!model) continue;

    const delegate = getDelegate(prisma, modelName);
    if (!delegate) {
      const msg = `No Prisma delegate for model "${modelName}" — skipped.`;
      failures.push({ model: modelName, batchIndex: -1, message: msg });
      if (!continueOnError) throw new Error(msg);
      continue;
    }

    const rawRows = backupTables[modelName];
    if (!Array.isArray(rawRows) || rawRows.length === 0) {
      insertedByModel[modelName] = 0;
      continue;
    }

    const pkFields = getPrimaryKeyFieldNames(model);
    let modelInserted = 0;

    const batches = chunk(rawRows, batchSize);
    for (let b = 0; b < batches.length; b++) {
      const batch = batches[b]!;
      const data = batch.map((r) => sanitizeRowForCreate(r as Record<string, unknown>, model));

      try {
        const { count } = await delegate.createMany({ data });
        modelInserted += count;
      } catch (e) {
        const batchMsg = e instanceof Error ? e.message : String(e);
        if (!continueOnError) {
          throw new Error(
            `Restore failed on model "${modelName}" batch ${b + 1}/${batches.length}: ${batchMsg}`,
          );
        }

        failures.push({
          model: modelName,
          batchIndex: b,
          message: `createMany failed: ${batchMsg}`,
        });

        for (let r = 0; r < data.length; r++) {
          const row = data[r]!;
          try {
            await delegate.create({ data: row });
            modelInserted += 1;
          } catch (rowErr) {
            const idHint =
              pkFields.length === 1 ? { [pkFields[0]!]: row[pkFields[0]!] } : { pk: pkFields.map((f) => row[f]) };
            failures.push({
              model: modelName,
              batchIndex: b,
              rowIndex: r,
              message: rowErr instanceof Error ? rowErr.message : String(rowErr),
              record: { ...idHint } as Record<string, unknown>,
            });
          }
        }
      }
    }

    insertedByModel[modelName] = modelInserted;
  }

  return { insertedByModel, failures };
}
