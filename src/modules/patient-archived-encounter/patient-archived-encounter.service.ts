import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PatientArchivedEncounterDocument } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateArchivedEncounterDto } from './dto/create-archived-encounter.dto';
import * as path from 'path';
import * as fs from 'fs';

const UPLOADS_ROOT = path.join(process.cwd(), 'uploads');
const STAGING_BASE = path.join(UPLOADS_ROOT, 'patients', 'archived', 'staging');
const ARCHIVE_BASE = path.join(UPLOADS_ROOT, 'patients', 'archived');

@Injectable()
export class PatientArchivedEncounterService {
  constructor(private readonly prisma: PrismaService) {}

  async createWithFiles(
    patientId: string,
    dto: CreateArchivedEncounterDto,
    files: Express.Multer.File[],
    uploadedById: string,
  ) {
    if (!files?.length) {
      throw new BadRequestException('At least one file is required.');
    }

    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
    });
    if (!patient) {
      throw new NotFoundException(`Patient "${patientId}" not found.`);
    }

    const staff = await this.prisma.staff.findUnique({
      where: { id: uploadedById },
    });
    if (!staff) {
      throw new NotFoundException(`Staff "${uploadedById}" not found.`);
    }

    const occurredAt = new Date(dto.encounterOccurredAt);
    if (Number.isNaN(occurredAt.getTime())) {
      throw new BadRequestException('Invalid encounterOccurredAt.');
    }

    const encounter = await this.prisma.patientArchivedEncounter.create({
      data: {
        patientId,
        encounterOccurredAt: occurredAt,
        title: dto.title ?? null,
        notes: dto.notes ?? null,
        uploadedById,
      },
    });

    const destDir = path.join(ARCHIVE_BASE, encounter.id);
    fs.mkdirSync(destDir, { recursive: true });

    const documents: PatientArchivedEncounterDocument[] = [];
    for (const file of files) {
      const stagingPath = (file as Express.Multer.File & { path?: string }).path;
      if (!stagingPath) continue;

      const baseName = path.basename(stagingPath);
      const destPath = path.join(destDir, baseName);
      fs.renameSync(stagingPath, destPath);

      const relativePath = path
        .relative(UPLOADS_ROOT, destPath)
        .split(path.sep)
        .join('/');

      const doc = await this.prisma.patientArchivedEncounterDocument.create({
        data: {
          archivedEncounterId: encounter.id,
          fileName: file.originalname || baseName,
          filePath: relativePath,
          mimeType: file.mimetype || null,
          fileSize: file.size || null,
        },
      });
      documents.push(doc);
    }

    return this.prisma.patientArchivedEncounter.findUnique({
      where: { id: encounter.id },
      include: {
        uploadedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
        documents: { orderBy: { uploadedAt: 'asc' } },
      },
    });
  }

  async listByPatient(patientId: string) {
    const patient = await this.prisma.patient.findUnique({
      where: { id: patientId },
    });
    if (!patient) {
      throw new NotFoundException(`Patient "${patientId}" not found.`);
    }

    return this.prisma.patientArchivedEncounter.findMany({
      where: { patientId },
      orderBy: { encounterOccurredAt: 'desc' },
      include: {
        uploadedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
        documents: {
          select: {
            id: true,
            fileName: true,
            mimeType: true,
            fileSize: true,
            uploadedAt: true,
          },
          orderBy: { uploadedAt: 'asc' },
        },
      },
    });
  }

  async getDocumentFile(documentId: string) {
    const doc = await this.prisma.patientArchivedEncounterDocument.findUnique({
      where: { id: documentId },
    });
    if (!doc) {
      throw new NotFoundException(`Document "${documentId}" not found.`);
    }
    const absolutePath = path.join(UPLOADS_ROOT, doc.filePath);
    if (!fs.existsSync(absolutePath)) {
      throw new NotFoundException('File not found on disk.');
    }
    return {
      filePath: absolutePath,
      fileName: doc.fileName,
      mimeType: doc.mimeType,
    };
  }

  async removeDocument(documentId: string) {
    const doc = await this.prisma.patientArchivedEncounterDocument.findUnique({
      where: { id: documentId },
      include: { archivedEncounter: true },
    });
    if (!doc) {
      throw new NotFoundException(`Document "${documentId}" not found.`);
    }

    const absolutePath = path.join(UPLOADS_ROOT, doc.filePath);
    if (fs.existsSync(absolutePath)) {
      try {
        fs.unlinkSync(absolutePath);
      } catch {
        // ignore missing file
      }
    }

    await this.prisma.patientArchivedEncounterDocument.delete({
      where: { id: documentId },
    });

    const remaining = await this.prisma.patientArchivedEncounterDocument.count({
      where: { archivedEncounterId: doc.archivedEncounterId },
    });
    if (remaining === 0) {
      const dir = path.join(ARCHIVE_BASE, doc.archivedEncounterId);
      if (fs.existsSync(dir)) {
        try {
          fs.rmdirSync(dir);
        } catch {
          // directory not empty or already removed
        }
      }
      await this.prisma.patientArchivedEncounter.delete({
        where: { id: doc.archivedEncounterId },
      });
    }

    return { message: 'Document deleted.' };
  }

  static stagingDirForPatient(patientId: string): string {
    const dir = path.join(STAGING_BASE, patientId);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }
}
