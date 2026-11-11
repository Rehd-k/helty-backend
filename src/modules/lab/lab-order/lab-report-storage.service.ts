import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

const FILENAME_RE = /^[A-Za-z0-9_-]{8,64}\.pdf$/i;

function uploadBase(): string {
  return path.join(process.cwd(), 'uploads', 'lab-reports');
}

@Injectable()
export class LabReportStorageService {
  private readonly logger = new Logger(LabReportStorageService.name);

  constructor(private readonly config: ConfigService) {}

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

  /**
   * Persists a PDF buffer under uploads/lab-reports and returns the public URL.
   * Meta must be able to fetch this URL (use a publicly reachable PUBLIC_API_BASE_URL).
   */
  async savePdf(buffer: Buffer): Promise<{ filename: string; pdfUrl: string }> {
    if (!buffer?.length) {
      throw new BadRequestException('Laboratory report PDF is empty.');
    }
    if (!buffer.subarray(0, 4).equals(Buffer.from('%PDF'))) {
      throw new BadRequestException('Invalid laboratory report PDF payload.');
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

    const filename = `${randomUUID().replace(/-/g, '')}.pdf`;
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
