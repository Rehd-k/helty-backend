/**
 * Full logical backup of all Prisma models to JSON (scalar + enum fields only).
 * Usage: `npx ts-node ./prisma/backup-restore/backup.ts` or `npm run db:backup`
 * Options: `--out=path` or env `BACKUP_FILE` (default: backup.json in cwd).
 * If you see P2022 (column does not exist): the database is behind `schema.prisma` — run
 * `npx prisma migrate deploy` in that environment. Optional: `BACKUP_SKIP_SCHEMA_MISMATCH=1` skips
 * failing models (partial backup; not recommended for production DR).
 */
import 'dotenv/config';
import { writeFileSync } from 'fs';
import { createScriptPrismaClient } from './lib/prisma-client';
import { filterWritableModels, loadDatamodel, modelNameToDelegateKey } from './lib/dmmf-models';
import { stringifyBackupPayload } from './lib/json-prisma';

type FindManyDelegate = {
  findMany: (args?: Record<string, never>) => Promise<Record<string, unknown>[]>;
};

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

function parseCli(): { outPath: string } {
  let outPath = process.env.BACKUP_FILE ?? 'backup.json';
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--out=')) {
      outPath = arg.slice('--out='.length);
    }
  }
  return { outPath };
}

async function main(): Promise<void> {
  const { outPath } = parseCli();
  const prisma = createScriptPrismaClient();
  await prisma.$connect();

  try {
    const datamodel = await loadDatamodel();
    const models = filterWritableModels(datamodel, prisma);
    const payload: Record<string, unknown> = {};
    const rowCounts: Record<string, number> = {};
    const skippedSchemaMismatch: { model: string; code: string; message: string }[] = [];
    const skipMismatch = process.env.BACKUP_SKIP_SCHEMA_MISMATCH === '1';

    for (const m of models) {
      const key = modelNameToDelegateKey(m.name);
      const delegate = (prisma as unknown as Record<string, FindManyDelegate>)[key];
      if (!delegate?.findMany) {
        console.warn(`Skipping "${m.name}": no findMany delegate.`);
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
            console.warn(`${hint}\nSkipping this model because BACKUP_SKIP_SCHEMA_MISMATCH=1.`);
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

    writeFileSync(outPath, stringifyBackupPayload(payload), 'utf-8');
    const totalRows = Object.values(rowCounts).reduce((a, b) => a + b, 0);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
