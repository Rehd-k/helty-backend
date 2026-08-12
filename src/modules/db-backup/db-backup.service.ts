import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { createReadStream, existsSync, readdirSync, statSync } from 'fs';
import { basename, join, relative, resolve, sep } from 'path';
import { PrismaService } from '../../prisma/prisma.service';
import {
  DB_BACKUP_DIR,
  backupFilePath,
  manualBackupFilename,
  scheduledBackupFilename,
} from './lib/backup-paths';
import { createBackupPayload } from './lib/create-backup-payload';
import { writeBackupFile } from './lib/write-backup-file';

export type DbBackupSource = 'scheduled' | 'manual';

export type DbBackupInfo = {
  filename: string;
  sizeBytes: number;
  createdAt: string;
};

@Injectable()
export class DbBackupService {
  private readonly logger = new Logger(DbBackupService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createBackup(source: DbBackupSource): Promise<DbBackupInfo> {
    const filename =
      source === 'scheduled'
        ? scheduledBackupFilename()
        : manualBackupFilename();
    const outPath = backupFilePath(filename);

    this.logger.log(`Starting ${source} DB backup → ${filename}`);
    const { payload, totalRows } = await createBackupPayload(this.prisma);
    const { sizeBytes } = writeBackupFile(outPath, payload);
    this.logger.log(
      `${source} DB backup finished: ${filename} (${totalRows} rows, ${sizeBytes} bytes)`,
    );

    const createdAt = new Date(statSync(outPath).mtimeMs).toISOString();
    return { filename, sizeBytes, createdAt };
  }

  listBackups(): DbBackupInfo[] {
    if (!existsSync(DB_BACKUP_DIR)) {
      return [];
    }
    return readdirSync(DB_BACKUP_DIR)
      .filter((name) => name.endsWith('.json.gz') || name.endsWith('.json'))
      .map((filename) => {
        const full = join(DB_BACKUP_DIR, filename);
        const st = statSync(full);
        return {
          filename,
          sizeBytes: st.size,
          createdAt: new Date(st.mtimeMs).toISOString(),
        };
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  getBackupStream(filename: string): StreamableFile {
    const safe = this.resolveSafeBackupPath(filename);
    if (!existsSync(safe)) {
      throw new NotFoundException(`Backup not found: ${filename}`);
    }
    const stream = createReadStream(safe);
    const contentType = safe.toLowerCase().endsWith('.gz')
      ? 'application/gzip'
      : 'application/json';
    return new StreamableFile(stream, {
      type: contentType,
      disposition: `attachment; filename="${basename(safe)}"`,
    });
  }

  private resolveSafeBackupPath(filename: string): string {
    const base = basename(filename);
    if (
      base !== filename ||
      base.includes('..') ||
      !/^backup-[\w.-]+\.json(\.gz)?$/i.test(base)
    ) {
      throw new BadRequestException('Invalid backup filename');
    }
    const full = resolve(backupFilePath(base));
    const root = resolve(DB_BACKUP_DIR);
    const rel = relative(root, full);
    if (rel.startsWith('..') || rel.includes(`..${sep}`)) {
      throw new BadRequestException('Invalid backup filename');
    }
    return full;
  }
}
