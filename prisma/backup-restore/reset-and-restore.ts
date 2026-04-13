/**
 * Runs `prisma migrate reset --force`, then restores `BACKUP_FILE` (default backup.json).
 *
 * Usage:
 * - `npm run db:reset-restore` — reset DB + restore (keeps existing migration history).
 * - `npm run db:reset-init-restore` — **delete all migration folders**, generate one new `*_init`
 *   migration from `schema.prisma`, then reset + restore.
 *
 * Flags: `--squash-init` (same as env `RESET_SQUASH_INIT=1`) to squash migrations before reset.
 *
 * Node runs the same on Windows and Linux; ensure `npx` and PostgreSQL client tools are on PATH.
 */
import 'dotenv/config';
import { spawnSync } from 'child_process';
import { runRestoreCli } from './restore';
import { squashMigrationsToInit } from './lib/squash-migrations-init';

function wantsSquashInit(): boolean {
  if (process.env.RESET_SQUASH_INIT === '1' || process.env.RESET_SQUASH_INIT === 'true') {
    return true;
  }
  return process.argv.includes('--squash-init');
}

function runMigrateReset(): void {
  const reset = spawnSync('npx', ['prisma', 'migrate', 'reset', '--force'], {
    stdio: 'inherit',
    cwd: process.cwd(),
    env: process.env,
    shell: process.platform === 'win32',
  });

  if (reset.status !== 0) {
    process.exit(reset.status ?? 1);
  }
  if (reset.error) {
    throw reset.error;
  }
}

async function main(): Promise<void> {
  if (wantsSquashInit()) {
    console.warn(
      'RESET_SQUASH_INIT / --squash-init: removing all folders under prisma/migrations (except migration_lock.toml), then generating a fresh *_init migration.',
    );
    const { migrationDir } = squashMigrationsToInit();
    console.warn(`New migration: ${migrationDir}`);
  }

  runMigrateReset();

  await runRestoreCli();
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
