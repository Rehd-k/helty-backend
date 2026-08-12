/**
 * Full logical backup of all Prisma models to gzipped JSON (scalar + enum fields only).
 * Usage: `npx ts-node ./prisma/backup-restore/backup.ts` or `npm run db:backup`
 * Options: `--out=path` or env `BACKUP_FILE`.
 * Default: `uploads/db-backups/backup-YYYY-MM-DD.json.gz` (hospital timezone date).
 * If you see P2022 (column does not exist): the database is behind `schema.prisma` — run
 * `npx prisma migrate deploy` in that environment. Optional: `BACKUP_SKIP_SCHEMA_MISMATCH=1` skips
 * failing models (partial backup; not recommended for production DR).
 */
import 'dotenv/config';
import { join } from 'path';
import { createScriptPrismaClient } from './lib/prisma-client';
import {
  DB_BACKUP_DIR,
  scheduledBackupFilename,
} from '../../src/modules/db-backup/lib/backup-paths';
import { createBackupPayload } from '../../src/modules/db-backup/lib/create-backup-payload';
import { writeBackupFile } from '../../src/modules/db-backup/lib/write-backup-file';

function parseCli(): { outPath: string } {
  let outPath =
    process.env.BACKUP_FILE ?? join(DB_BACKUP_DIR, scheduledBackupFilename());
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
    const { payload, totalRows } = await createBackupPayload(prisma);
    const { path, sizeBytes } = writeBackupFile(outPath, payload);
    console.log(
      `Backup written to ${path} (${totalRows} rows, ${sizeBytes} bytes)`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
