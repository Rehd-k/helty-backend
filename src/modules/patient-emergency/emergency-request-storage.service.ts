import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type EmergencyMediaKind = 'voice' | 'video';

const VOICE_EXT: Record<string, string> = {
  'audio/mp4': 'm4a',
  'audio/m4a': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/aac': 'aac',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/webm': 'webm',
};

const VIDEO_EXT: Record<string, string> = {
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
  'video/3gpp': '3gp',
};

function uploadBase(): string {
  return path.join(process.cwd(), 'uploads', 'emergency-requests');
}

@Injectable()
export class EmergencyRequestStorageService {
  assertValidUuid(id: string): void {
    if (!UUID_RE.test(id)) {
      throw new BadRequestException('Invalid request id');
    }
  }

  dirForRequest(requestId: string): string {
    this.assertValidUuid(requestId);
    return path.join(uploadBase(), requestId);
  }

  extensionFor(kind: EmergencyMediaKind, mime: string): string {
    const map = kind === 'voice' ? VOICE_EXT : VIDEO_EXT;
    const ext = map[mime.toLowerCase()];
    if (!ext) {
      throw new BadRequestException(`Unsupported ${kind} mime type: ${mime}`);
    }
    return ext;
  }

  isAllowedMime(kind: EmergencyMediaKind, mime: string): boolean {
    const map = kind === 'voice' ? VOICE_EXT : VIDEO_EXT;
    return !!map[mime.toLowerCase()];
  }

  saveFile(
    requestId: string,
    kind: EmergencyMediaKind,
    file: Express.Multer.File,
  ): string {
    this.assertValidUuid(requestId);
    if (!file?.buffer?.length) {
      throw new BadRequestException(`Missing ${kind} file`);
    }
    const ext = this.extensionFor(kind, file.mimetype);
    const dir = this.dirForRequest(requestId);
    fs.mkdirSync(dir, { recursive: true });
    const filename = `${kind}-${randomUUID()}.${ext}`;
    const filePath = path.join(dir, filename);
    try {
      fs.writeFileSync(filePath, file.buffer);
    } catch {
      throw new InternalServerErrorException(`Failed to store ${kind} file`);
    }
    return `/uploads/emergency-requests/${requestId}/${filename}`;
  }

  resolvePath(requestId: string, relativeOrStoredUrl: string): string {
    this.assertValidUuid(requestId);
    const filename = path.basename(relativeOrStoredUrl);
    if (!filename || filename === '.' || filename === '..') {
      throw new NotFoundException('Media file not found');
    }
    const filePath = path.join(this.dirForRequest(requestId), filename);
    const resolved = path.resolve(filePath);
    const baseResolved = path.resolve(uploadBase());
    if (!resolved.startsWith(baseResolved) || !fs.existsSync(resolved)) {
      throw new NotFoundException('Media file not found');
    }
    return resolved;
  }

  deleteRequestDir(requestId: string): void {
    if (!UUID_RE.test(requestId)) return;
    const dir = this.dirForRequest(requestId);
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }

  contentTypeForFilename(filename: string): string {
    const ext = path.extname(filename).toLowerCase().replace('.', '');
    const map: Record<string, string> = {
      m4a: 'audio/mp4',
      aac: 'audio/aac',
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      webm: 'audio/webm',
      mp4: 'video/mp4',
      mov: 'video/quicktime',
      '3gp': 'video/3gpp',
    };
    return map[ext] ?? 'application/octet-stream';
  }
}
