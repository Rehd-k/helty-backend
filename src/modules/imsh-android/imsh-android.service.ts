import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import * as fs from 'fs';
import { createReadStream } from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import type { Response } from 'express';

const UPLOAD_ROOT = path.join(process.cwd(), 'uploads', 'imsh-android');
const TMP_DIR = path.join(UPLOAD_ROOT, 'tmp');
const SESSIONS_DIR = path.join(TMP_DIR, 'sessions');
const MAX_FILE_BYTES = 500 * 1024 * 1024;
const DEFAULT_CHUNK_SIZE = 2 * 1024 * 1024;
const MAX_CHUNK_SIZE = 8 * 1024 * 1024;

type ChunkedUploadMeta = {
  uploadId: string;
  kind: 'release';
  version?: string;
  totalBytes: number;
  chunkSize: number;
  totalChunks: number;
  createdAt: string;
};

@Injectable()
export class ImshAndroidService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private get expectedPassword(): string {
    return (
      this.config.get<string>('IMSH_ANDROID_UPLOAD_PASSWORD') ?? 'vesselinc'
    );
  }

  private sessionDir(uploadId: string): string {
    return path.join(SESSIONS_DIR, uploadId);
  }

  private metaPath(uploadId: string): string {
    return path.join(this.sessionDir(uploadId), 'meta.json');
  }

  private chunkPath(uploadId: string, index: number): string {
    return path.join(
      this.sessionDir(uploadId),
      `chunk-${String(index).padStart(5, '0')}`,
    );
  }

  private async readSessionMeta(uploadId: string): Promise<ChunkedUploadMeta> {
    const id = uploadId.trim();
    if (!/^[a-zA-Z0-9_-]{8,64}$/.test(id)) {
      throw new BadRequestException('Invalid uploadId');
    }
    try {
      const raw = await fsp.readFile(this.metaPath(id), 'utf8');
      return JSON.parse(raw) as ChunkedUploadMeta;
    } catch {
      throw new NotFoundException('Upload session not found');
    }
  }

  private async writeSessionMeta(meta: ChunkedUploadMeta): Promise<void> {
    await fsp.mkdir(this.sessionDir(meta.uploadId), { recursive: true });
    await fsp.writeFile(
      this.metaPath(meta.uploadId),
      JSON.stringify(meta, null, 2),
      'utf8',
    );
  }

  private async removeSession(uploadId: string): Promise<void> {
    await fsp
      .rm(this.sessionDir(uploadId), { recursive: true, force: true })
      .catch(() => undefined);
  }

  private async listReceivedChunks(uploadId: string): Promise<number[]> {
    let entries: string[];
    try {
      entries = await fsp.readdir(this.sessionDir(uploadId));
    } catch {
      return [];
    }
    const indexes: number[] = [];
    for (const name of entries) {
      const m = /^chunk-(\d{5})$/.exec(name);
      if (m) indexes.push(Number(m[1]));
    }
    return indexes.sort((a, b) => a - b);
  }

  async initChunkedUpload(input: {
    kind: 'release';
    version?: string;
    totalBytes: number;
    chunkSize: number;
  }): Promise<{
    uploadId: string;
    chunkSize: number;
    totalChunks: number;
    totalBytes: number;
  }> {
    if (!Number.isFinite(input.totalBytes) || input.totalBytes < 1) {
      throw new BadRequestException('totalBytes must be a positive number');
    }
    if (input.totalBytes > MAX_FILE_BYTES) {
      throw new BadRequestException(
        `File exceeds max size of ${MAX_FILE_BYTES} bytes`,
      );
    }

    this.sanitizeVersionForFileName(input.version ?? '');

    const chunkSize = Math.min(
      MAX_CHUNK_SIZE,
      Math.max(256 * 1024, Math.floor(input.chunkSize) || DEFAULT_CHUNK_SIZE),
    );
    const totalChunks = Math.ceil(input.totalBytes / chunkSize);
    const uploadId = `${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 10)}`;

    const meta: ChunkedUploadMeta = {
      uploadId,
      kind: 'release',
      version: input.version?.trim(),
      totalBytes: input.totalBytes,
      chunkSize,
      totalChunks,
      createdAt: new Date().toISOString(),
    };

    await this.writeSessionMeta(meta);
    return {
      uploadId,
      chunkSize,
      totalChunks,
      totalBytes: input.totalBytes,
    };
  }

  async getChunkedUploadStatus(uploadId: string): Promise<{
    uploadId: string;
    kind: 'release';
    totalBytes: number;
    chunkSize: number;
    totalChunks: number;
    receivedChunks: number[];
  }> {
    const meta = await this.readSessionMeta(uploadId);
    const receivedChunks = await this.listReceivedChunks(meta.uploadId);
    return {
      uploadId: meta.uploadId,
      kind: meta.kind,
      totalBytes: meta.totalBytes,
      chunkSize: meta.chunkSize,
      totalChunks: meta.totalChunks,
      receivedChunks,
    };
  }

  async saveChunk(
    uploadId: string,
    index: number,
    tempFilePath: string,
  ): Promise<{ index: number; received: number; totalChunks: number }> {
    const meta = await this.readSessionMeta(uploadId);
    if (!Number.isInteger(index) || index < 0 || index >= meta.totalChunks) {
      await fsp.unlink(tempFilePath).catch(() => undefined);
      throw new BadRequestException(
        `chunk index must be 0..${meta.totalChunks - 1}`,
      );
    }

    let size = 0;
    try {
      size = (await fsp.stat(tempFilePath)).size;
    } catch {
      throw new BadRequestException('chunk file missing');
    }

    const expected =
      index === meta.totalChunks - 1
        ? meta.totalBytes - meta.chunkSize * (meta.totalChunks - 1)
        : meta.chunkSize;
    if (size !== expected) {
      await fsp.unlink(tempFilePath).catch(() => undefined);
      throw new BadRequestException(
        `chunk ${index} size mismatch (got ${size}, expected ${expected})`,
      );
    }

    const dest = this.chunkPath(meta.uploadId, index);
    try {
      await fsp.rename(tempFilePath, dest);
    } catch {
      await fsp.copyFile(tempFilePath, dest);
      await fsp.unlink(tempFilePath).catch(() => undefined);
    }

    const received = (await this.listReceivedChunks(meta.uploadId)).length;
    return { index, received, totalChunks: meta.totalChunks };
  }

  private async assembleSessionFile(meta: ChunkedUploadMeta): Promise<string> {
    const received = await this.listReceivedChunks(meta.uploadId);
    if (received.length !== meta.totalChunks) {
      throw new BadRequestException(
        `Upload incomplete: ${received.length}/${meta.totalChunks} chunks`,
      );
    }
    for (let i = 0; i < meta.totalChunks; i++) {
      if (received[i] !== i) {
        throw new BadRequestException(`Missing chunk ${i}`);
      }
    }

    await fsp.mkdir(TMP_DIR, { recursive: true });
    const assembled = path.join(TMP_DIR, `${meta.uploadId}.assembled`);
    await fsp.unlink(assembled).catch(() => undefined);

    const out = await fsp.open(assembled, 'w');
    try {
      for (let i = 0; i < meta.totalChunks; i++) {
        const data = await fsp.readFile(this.chunkPath(meta.uploadId, i));
        await out.write(data);
      }
    } catch (e) {
      await out.close().catch(() => undefined);
      await fsp.unlink(assembled).catch(() => undefined);
      throw e;
    }
    await out.close();

    const assembledSize = (await fsp.stat(assembled)).size;
    if (assembledSize !== meta.totalBytes) {
      await fsp.unlink(assembled).catch(() => undefined);
      throw new BadRequestException(
        `Assembled size mismatch (got ${assembledSize}, expected ${meta.totalBytes})`,
      );
    }
    return assembled;
  }

  async completeChunkedRelease(uploadId: string): Promise<{
    id: string;
    version: string;
    fileName: string;
  }> {
    const meta = await this.readSessionMeta(uploadId);
    if (meta.kind !== 'release' || !meta.version) {
      throw new BadRequestException('Upload session is not a release upload');
    }
    const assembled = await this.assembleSessionFile(meta);
    try {
      return await this.createReleaseFromUpload(meta.version, assembled);
    } finally {
      await this.removeSession(meta.uploadId);
    }
  }

  assertUploadPassword(bodyPassword?: string, headerPassword?: string): void {
    const provided =
      (typeof bodyPassword === 'string' ? bodyPassword.trim() : '') ||
      (typeof headerPassword === 'string' ? headerPassword.trim() : '');
    if (!provided || provided !== this.expectedPassword) {
      throw new ForbiddenException('Invalid upload password');
    }
  }

  /** Safe segment for imsh{segment}.apk */
  sanitizeVersionForFileName(version: string): string {
    const v = version.trim();
    if (!v) {
      throw new BadRequestException('version is required');
    }
    const safe = v.replace(/[^a-zA-Z0-9._-]/g, '_');
    if (!safe.length) {
      throw new BadRequestException(
        'version must contain letters, digits, dots, dash, or underscore',
      );
    }
    return safe;
  }

  async createReleaseFromUpload(
    version: string,
    tempFilePath: string,
  ): Promise<{ id: string; version: string; fileName: string }> {
    const safe = this.sanitizeVersionForFileName(version);
    const fileName = `imsh${safe}.apk`;
    const relativePath = fileName;

    await fsp.mkdir(UPLOAD_ROOT, { recursive: true });

    const finalPath = path.join(UPLOAD_ROOT, fileName);

    try {
      await fsp.rename(tempFilePath, finalPath);
    } catch {
      await fsp.copyFile(tempFilePath, finalPath);
      await fsp.unlink(tempFilePath).catch(() => undefined);
    }

    const normalizedVersion = version.trim();

    try {
      const row = await this.prisma.imshAndroidRelease.create({
        data: {
          version: normalizedVersion,
          fileName,
          relativePath,
        },
      });
      return {
        id: row.id,
        version: row.version,
        fileName: row.fileName,
      };
    } catch (e: unknown) {
      await fsp.unlink(finalPath).catch(() => undefined);
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException(
          'This version already exists. Use a new version number.',
        );
      }
      throw e;
    }
  }

  async getLatestVersionJson(): Promise<{ version: string }> {
    const latest = await this.prisma.imshAndroidRelease.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { version: true },
    });
    if (!latest) {
      throw new NotFoundException('No Android release has been published yet');
    }

    return { version: latest.version };
  }

  async getManifest(baseUrl: string): Promise<{
    version: string;
    downloadUrl: string;
    fileName: string;
  }> {
    const latest = await this.prisma.imshAndroidRelease.findFirst({
      orderBy: { createdAt: 'desc' },
    });
    if (!latest) {
      throw new NotFoundException('No Android release has been published yet');
    }
    const downloadUrl = `${baseUrl.replace(/\/$/, '')}/imsh-android/download/latest`;
    return {
      version: latest.version,
      downloadUrl,
      fileName: latest.fileName,
    };
  }

  async listReleases() {
    return this.prisma.imshAndroidRelease.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        version: true,
        fileName: true,
        createdAt: true,
      },
    });
  }

  async deleteRelease(
    version: string,
    bodyPassword?: string,
    headerPassword?: string,
  ): Promise<{ deleted: true; version: string }> {
    this.assertUploadPassword(bodyPassword, headerPassword);
    const trimmed = version.trim();
    if (!trimmed) {
      throw new BadRequestException('version is required');
    }

    const release = await this.prisma.imshAndroidRelease.findUnique({
      where: { version: trimmed },
    });
    if (!release) {
      throw new NotFoundException('Release not found');
    }

    const safe = this.sanitizeVersionForFileName(release.version);
    const prefix = `imsh${safe}`;

    let entries: string[];
    try {
      entries = await fsp.readdir(UPLOAD_ROOT);
    } catch {
      entries = [];
    }
    for (const name of entries) {
      if (name.startsWith(prefix)) {
        await fsp.unlink(path.join(UPLOAD_ROOT, name)).catch(() => undefined);
      }
    }

    await this.prisma.imshAndroidRelease.delete({
      where: { version: trimmed },
    });

    return { deleted: true, version: trimmed };
  }

  private async resolveReleaseForDownload(version?: 'latest' | string) {
    if (!version || version === 'latest') {
      return this.prisma.imshAndroidRelease.findFirst({
        orderBy: { createdAt: 'desc' },
      });
    }
    return this.prisma.imshAndroidRelease.findUnique({
      where: { version: version.trim() },
    });
  }

  async pipeDownloadToResponse(
    res: Response,
    version: 'latest' | string | undefined,
    baseUrl: string,
  ): Promise<void> {
    const release = await this.resolveReleaseForDownload(version);
    if (!release) {
      throw new NotFoundException('Release not found');
    }
    const abs = path.join(UPLOAD_ROOT, release.relativePath);
    if (!fs.existsSync(abs)) {
      throw new NotFoundException('APK file missing on server');
    }
    const downloadName = release.fileName;
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(downloadName)}"`,
    );
    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    res.setHeader('X-Imsh-Version', release.version);
    res.setHeader(
      'X-Imsh-Download-Url',
      `${baseUrl.replace(/\/$/, '')}/imsh-android/download/latest`,
    );
    const stream = createReadStream(abs);
    stream.pipe(res);
  }
}
