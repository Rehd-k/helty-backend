import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const FILENAME_RE = /^[a-f0-9]{32,64}\.pdf$/i;

function uploadBase(): string {
  return path.join(process.cwd(), 'uploads', 'lab-reports');
}

@Injectable()
export class LabReportStorageService {
  private readonly logger = new Logger(LabReportStorageService.name);

  constructor(private readonly config: ConfigService) {}

  /** Stable cache key for a patient + selected items + current result fingerprint. */
  buildCacheKey(patientId: string, orderItemIds: string[], fingerprint: string): string {
    const items = [...orderItemIds].map((id) => id.trim()).filter(Boolean).sort();
    return createHash('sha256')
      .update(`${patientId.trim()}|${items.join(',')}|${fingerprint}`)
      .digest('hex');
  }

  filenameForCacheKey(cacheKey: string): string {
    return `${cacheKey}.pdf`;
  }

  /** Absolute path for a stored report filename, or null if invalid / missing. */
  resolvePath(filename: string): string | null {
    if (!FILENAME_RE.test(filename)) return null;
    const filePath = path.join(uploadBase(), filename);
    if (!filePath.startsWith(uploadBase())) return null;
    if (!fs.existsSync(filePath)) return null;
    return filePath;
  }

  buildPublicUrl(filename: string): string {
    const base =
      this.config.get<string>('PUBLIC_API_BASE_URL')?.replace(/\/$/, '') ?? '';
    if (!base) {
      throw new InternalServerErrorException(
        'PUBLIC_API_BASE_URL is required to publish lab report links for WhatsApp.',
      );
    }
    return `${base}/uploads/lab-reports/${filename}`;
  }

  findCached(
    cacheKey: string,
  ): { filename: string; pdfUrl: string; filePath: string } | null {
    const filename = this.filenameForCacheKey(cacheKey);
    const filePath = this.resolvePath(filename);
    if (!filePath) return null;
    return {
      filename,
      filePath,
      pdfUrl: this.buildPublicUrl(filename),
    };
  }

  async readCachedBuffer(cacheKey: string): Promise<Buffer | null> {
    const cached = this.findCached(cacheKey);
    if (!cached) return null;
    try {
      return await fs.promises.readFile(cached.filePath);
    } catch (err) {
      this.logger.warn(
        `Failed to read cached lab report ${cached.filename}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return null;
    }
  }

  /**
   * Persists a PDF under a deterministic cache key (overwrites if present).
   * Meta must be able to fetch the returned URL.
   */
  async savePdfForCacheKey(
    cacheKey: string,
    buffer: Buffer,
  ): Promise<{ filename: string; pdfUrl: string }> {
    if (!buffer?.length) {
      throw new BadRequestException('Laboratory report PDF is empty.');
    }
    if (!buffer.subarray(0, 4).equals(Buffer.from('%PDF'))) {
      throw new BadRequestException('Invalid laboratory report PDF payload.');
    }
    if (!/^[a-f0-9]{32,64}$/i.test(cacheKey)) {
      throw new BadRequestException('Invalid laboratory report cache key.');
    }

    const dir = uploadBase();
    try {
      fs.mkdirSync(dir, { recursive: true });
    } catch (err) {
      this.logger.error(
        `Failed to create lab-reports directory: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      throw new InternalServerErrorException(
        'Could not prepare lab report storage.',
      );
    }

    const filename = this.filenameForCacheKey(cacheKey);
    const filePath = path.join(dir, filename);
    try {
      await fs.promises.writeFile(filePath, buffer);
    } catch (err) {
      this.logger.error(
        `Failed to write lab report PDF: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      throw new InternalServerErrorException(
        'Could not store laboratory report PDF.',
      );
    }

    return {
      filename,
      pdfUrl: this.buildPublicUrl(filename),
    };
  }
}
