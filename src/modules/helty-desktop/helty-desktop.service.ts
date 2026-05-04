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

const UPLOAD_ROOT = path.join(process.cwd(), 'uploads', 'helty-desktop');
const TMP_DIR = path.join(UPLOAD_ROOT, 'tmp');

@Injectable()
export class HeltyDesktopService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private get expectedPassword(): string {
    return (
      this.config.get<string>('HELITY_DESKTOP_UPLOAD_PASSWORD') ?? 'vesselinc'
    );
  }

  assertUploadPassword(bodyPassword?: string, headerPassword?: string): void {
    const provided =
      (typeof bodyPassword === 'string' ? bodyPassword.trim() : '') ||
      (typeof headerPassword === 'string' ? headerPassword.trim() : '');
    if (!provided || provided !== this.expectedPassword) {
      throw new ForbiddenException('Invalid upload password');
    }
  }

  /** Safe segment for helty{segment}.exe */
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
    const fileName = `helty${safe}.exe`;
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
      const row = await this.prisma.heltyDesktopRelease.create({
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
    const latest = await this.prisma.heltyDesktopRelease.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { version: true },
    });
    if (!latest) {
      throw new NotFoundException('No desktop release has been published yet');
    }

    return { version: latest.version };
  }

  async getManifest(baseUrl: string): Promise<{
    version: string;
    downloadUrl: string;
    fileName: string;
  }> {
    const latest = await this.prisma.heltyDesktopRelease.findFirst({
      orderBy: { createdAt: 'desc' },
    });
    if (!latest) {
      throw new NotFoundException('No desktop release has been published yet');
    }
    const downloadUrl = `${baseUrl.replace(/\/$/, '')}/helty-desktop/download/latest`;
    return {
      version: latest.version,
      downloadUrl,
      fileName: latest.fileName,
    };
  }

  async listReleases() {
    return this.prisma.heltyDesktopRelease.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        version: true,
        fileName: true,
        createdAt: true,
      },
    });
  }

  /**
   * Removes the DB row and all files under uploads/helty-desktop/ whose names
   * start with helty{sanitizedVersion} (main .exe plus any sidecars, e.g. blockmaps).
   */
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

    const release = await this.prisma.heltyDesktopRelease.findUnique({
      where: { version: trimmed },
    });
    if (!release) {
      throw new NotFoundException('Release not found');
    }

    const safe = this.sanitizeVersionForFileName(release.version);
    const prefix = `helty${safe}`;

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

    await this.prisma.heltyDesktopRelease.delete({
      where: { version: trimmed },
    });

    return { deleted: true, version: trimmed };
  }

  private async resolveReleaseForDownload(version?: 'latest' | string) {
    if (!version || version === 'latest') {
      return this.prisma.heltyDesktopRelease.findFirst({
        orderBy: { createdAt: 'desc' },
      });
    }
    return this.prisma.heltyDesktopRelease.findUnique({
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
      throw new NotFoundException('Installer file missing on server');
    }
    const downloadName = release.fileName;
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(downloadName)}"`,
    );
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('X-Helty-Version', release.version);
    res.setHeader(
      'X-Helty-Download-Url',
      `${baseUrl.replace(/\/$/, '')}/helty-desktop/download/latest`,
    );
    const stream = createReadStream(abs);
    stream.pipe(res);
  }

  /** Safe stored filename for extra assets (e.g. `toolname.exe`). */
  sanitizeExternalExecutableName(name: string): string {
    const raw = name.trim();
    if (!raw) {
      throw new BadRequestException('name is required');
    }
    // Accept `tool.exe` or `tool` and store as `<safe>.exe`.
    const lower = raw.toLowerCase();
    const noExt = lower.endsWith('.exe') ? raw.slice(0, -4) : raw;
    const safeBase = noExt.replace(/[^a-zA-Z0-9._-]/g, '_');
    if (!safeBase.length) {
      throw new BadRequestException(
        'name must contain letters, digits, dots, dash, or underscore',
      );
    }
    return `${safeBase}.exe`;
  }

  async createExternalExecutableFromUpload(
    name: string,
    description: string | undefined,
    tempFilePath: string,
  ): Promise<{ id: string; fileName: string; description: string | null }> {
    const fileName = this.sanitizeExternalExecutableName(name);
    const relativePath = fileName;
    const normalizedDescription =
      typeof description === 'string' && description.trim().length
        ? description.trim()
        : null;

    await fsp.mkdir(UPLOAD_ROOT, { recursive: true });
    const finalPath = path.join(UPLOAD_ROOT, fileName);

    try {
      await fsp.rename(tempFilePath, finalPath);
    } catch {
      await fsp.copyFile(tempFilePath, finalPath);
      await fsp.unlink(tempFilePath).catch(() => undefined);
    }

    try {
      const row = await this.prisma.heltyDesktopExternalExecutable.create({
        data: {
          fileName,
          description: normalizedDescription,
          relativePath,
        },
      });
      return {
        id: row.id,
        fileName: row.fileName,
        description: row.description,
      };
    } catch (e: unknown) {
      await fsp.unlink(finalPath).catch(() => undefined);
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        throw new ConflictException(
          'This file name already exists. Use a different name.',
        );
      }
      throw e;
    }
  }

  async listExternalExecutables() {
    return this.prisma.heltyDesktopExternalExecutable.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        fileName: true,
        description: true,
        createdAt: true,
      },
    });
  }

  async deleteExternalExecutable(
    fileName: string,
    bodyPassword?: string,
    headerPassword?: string,
  ): Promise<{ deleted: true; fileName: string }> {
    this.assertUploadPassword(bodyPassword, headerPassword);
    const trimmed = fileName.trim();
    if (!trimmed) {
      throw new BadRequestException('fileName is required');
    }

    const release = await this.prisma.heltyDesktopExternalExecutable.findUnique(
      {
        where: { fileName: trimmed },
      },
    );
    if (!release) {
      throw new NotFoundException('File not found');
    }

    // Remove the main `.exe` and any "sidecar" files that start with the same name
    // (e.g. `tool.exe.blockmap`, `tool.exe.sha256`, ...).
    const prefix = release.fileName;
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

    await this.prisma.heltyDesktopExternalExecutable.delete({
      where: { fileName: trimmed },
    });

    return { deleted: true, fileName: trimmed };
  }

  private async resolveExternalExecutableForDownload(fileName: string) {
    return this.prisma.heltyDesktopExternalExecutable.findUnique({
      where: { fileName: fileName.trim() },
    });
  }

  async pipeExternalExecutableDownloadToResponse(
    res: Response,
    fileName: string,
    baseUrl: string,
  ): Promise<void> {
    const asset = await this.resolveExternalExecutableForDownload(fileName);
    if (!asset) {
      throw new NotFoundException('File not found');
    }

    const abs = path.join(UPLOAD_ROOT, asset.relativePath);
    if (!fs.existsSync(abs)) {
      throw new NotFoundException('Installer file missing on server');
    }

    const downloadName = asset.fileName;
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(downloadName)}"`,
    );
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('X-Helty-Asset-Name', asset.fileName);
    if (asset.description) {
      res.setHeader('X-Helty-Asset-Description', asset.description);
    }
    // Useful if your Flutter client wants a canonical link.
    res.setHeader(
      'X-Helty-Asset-Download-Url',
      `${baseUrl.replace(/\/$/, '')}/helty-desktop/assets/download/${encodeURIComponent(
        asset.fileName,
      )}`,
    );

    const stream = createReadStream(abs);
    stream.pipe(res);
  }
}
