/**
 * Full logical backup of all Prisma models to JSON (scalar + enum fields only).
 * Usage: `npx ts-node ./prisma/backup-restore/backup.ts` or `npm run db:backup`
 * Options: `--out=path` or env `BACKUP_FILE` (default: backup.json in cwd).
 */
import 'dotenv/config';
import { writeFileSync } from 'fs';
import { createScriptPrismaClient } from './lib/prisma-client';
import { filterWritableModels, loadDatamodel, modelNameToDelegateKey } from './lib/dmmf-models';
import { stringifyBackupPayload } from './lib/json-prisma';

type FindManyDelegate = {
  findMany: (args?: Record<string, never>) => Promise<Record<string, unknown>[]>;
};

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

    for (const m of models) {
      const key = modelNameToDelegateKey(m.name);
      const delegate = (prisma as unknown as Record<string, FindManyDelegate>)[key];
      if (!delegate?.findMany) {
        console.warn(`Skipping "${m.name}": no findMany delegate.`);
        continue;
      }
      const rows = await delegate.findMany();
      payload[m.name] = rows;
      rowCounts[m.name] = rows.length;
    }

    payload._meta = {
      version: 1,
      createdAt: new Date().toISOString(),
      rowCounts,
    };

    writeFileSync(outPath, stringifyBackupPayload(payload), 'utf-8');
    const totalRows = Object.values(rowCounts).reduce((a, b) => a + b, 0);
    console.log(`Backup complete: ${outPath} (${models.length} models, ${totalRows} rows).`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
