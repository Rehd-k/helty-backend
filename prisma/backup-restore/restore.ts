/**
 * Restores backup JSON produced by backup.ts. Preserves explicit primary keys and FK scalars.
 * Usage: `npx ts-node ./prisma/backup-restore/restore.ts` or `npm run db:restore`
 * Options: `--file=path`, env `BACKUP_FILE`, `--continue-on-error`, env `RESTORE_BATCH_SIZE`, `SYNC_SEQUENCES=1`.
 * Env `RESTORE_PG_DEFER_FK=0` disables PostgreSQL `session_replication_role = replica` (stricter FK order; fails on self-FKs / cycles).
 */
import 'dotenv/config';
import { readFileSync } from 'fs';
import type { PrismaClient } from '@prisma/client';
import { createScriptPrismaClient } from './lib/prisma-client';
import { filterWritableModels, loadDatamodel } from './lib/dmmf-models';
import { computeInsertOrder } from './lib/insert-order';
import { parseBackupJson } from './lib/json-prisma';
import { runBatchedRestore } from './lib/restore-runner';
import { syncPostgresSequences } from './lib/sequence-sync';

function parseCli(): { filePath: string; continueOnError: boolean } {
  let filePath = process.env.BACKUP_FILE ?? 'backup.json';
  let continueOnError = false;
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--file=')) {
      filePath = arg.slice('--file='.length);
    }
    if (arg === '--continue-on-error') {
      continueOnError = true;
    }
  }
  return { filePath, continueOnError };
}

function extractTables(parsed: Record<string, unknown>): Record<string, unknown[]> {
  const { _meta: _drop, ...rest } = parsed;
  const tables: Record<string, unknown[]> = {};
  for (const [k, v] of Object.entries(rest)) {
    if (k.startsWith('_')) continue;
    if (Array.isArray(v)) {
      tables[k] = v;
    } else {
      console.warn(`Skipping backup key "${k}": expected array, got ${typeof v}.`);
    }
  }
  return tables;
}

export async function runRestoreCli(): Promise<void> {
  const { filePath, continueOnError } = parseCli();
  const raw = readFileSync(filePath, 'utf-8');
  const parsed = parseBackupJson(raw) as Record<string, unknown>;
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Backup file must contain a JSON object.');
  }

  const backupTables = extractTables(parsed);
  const prisma = createScriptPrismaClient();
  await prisma.$connect();

  const batchSize = Math.max(1, parseInt(process.env.RESTORE_BATCH_SIZE ?? '500', 10) || 500);
  const longTx = { maxWait: 60_000, timeout: 3_600_000 };

  try {
    const datamodel = await loadDatamodel();
    const models = filterWritableModels(datamodel, prisma);
    const modelsByName = new Map(models.map((m) => [m.name, m]));
    const { order, hasCycle } = computeInsertOrder(models);
    const deferPgFk =
      process.env.RESTORE_PG_DEFER_FK !== '0' && process.env.RESTORE_PG_DEFER_FK !== 'false';

    if (!deferPgFk && hasCycle) {
      throw new Error(
        'FK graph has cycles that cannot be resolved by insert order alone. Remove RESTORE_PG_DEFER_FK=0 or use the default (deferred FK checks via session_replication_role).',
      );
    }

    if (deferPgFk && hasCycle) {
      console.warn(
        'FK graph has remaining cycles (after ignoring self-relations). Restoring with PostgreSQL deferred FK checks.',
      );
    }

    const run = async (client: PrismaClient) =>
      runBatchedRestore({
        prisma: client,
        modelsByName,
        insertOrder: order,
        backupTables,
        batchSize,
        continueOnError,
      });

    let summary;
    if (deferPgFk) {
      summary = await prisma.$transaction(
        async (tx) => {
          await tx.$executeRawUnsafe(`SET LOCAL session_replication_role = replica`);
          return run(tx as unknown as PrismaClient);
        },
        longTx,
      );
    } else {
      summary = await run(prisma);
    }

    console.log('Restore summary (rows reported by createMany/create):');
    console.log(JSON.stringify(summary.insertedByModel, null, 2));

    if (summary.failures.length > 0) {
      console.warn(`Completed with ${summary.failures.length} failure record(s).`);
      console.warn(JSON.stringify(summary.failures, null, 2));
      process.exitCode = 1;
    }

    if (process.env.SYNC_SEQUENCES === '1') {
      console.log('SYNC_SEQUENCES=1 — syncing PostgreSQL sequences for autoincrement IDs…');
      await syncPostgresSequences(prisma, models);
    }
  } finally {
    await prisma.$disconnect();
  }
}

function isLaunchedAsRestoreScript(): boolean {
  const arg = process.argv[1];
  if (!arg) return false;
  const norm = arg.replace(/\\/g, '/').toLowerCase();
  return (
    norm.endsWith('/restore.ts') ||
    norm.endsWith('/restore.js') ||
    norm.endsWith('\\restore.ts') ||
    norm.endsWith('\\restore.js')
  );
}

void (async () => {
  if (!isLaunchedAsRestoreScript()) return;
  try {
    await runRestoreCli();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
