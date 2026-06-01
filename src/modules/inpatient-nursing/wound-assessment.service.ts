import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  assertAdmissionExists,
  assertAdmissionWritable,
  assertStaffIsNurseOrThrow,
} from './inpatient-nursing.utils';
import { CreateWoundAssessmentDto } from './dto/nursing-docs.dto';
import * as path from 'path';
import * as fs from 'fs';

const UPLOAD_BASE = path.join(process.cwd(), 'uploads', 'wound-assessments');

const PHOTO_MIME_BY_EXT: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
};

const nurseSelect = {
  id: true,
  firstName: true,
  lastName: true,
  staffRole: true,
} as const;

@Injectable()
export class WoundAssessmentService {
  constructor(private readonly prisma: PrismaService) {}

  static uploadDirForAdmission(admissionId: string): string {
    return path.join(UPLOAD_BASE, admissionId);
  }

  async list(admissionId: string) {
    await assertAdmissionExists(this.prisma, admissionId);
    return this.prisma.woundAssessment.findMany({
      where: { admissionId },
      orderBy: { recordedAt: 'desc' },
      include: { nurse: { select: nurseSelect } },
    });
  }

  async create(
    admissionId: string,
    dto: CreateWoundAssessmentDto,
    staffId: string,
    file?: Express.Multer.File,
  ) {
    const admission = await assertAdmissionExists(this.prisma, admissionId);
    assertAdmissionWritable(admission);
    await assertStaffIsNurseOrThrow(this.prisma, staffId);

    const photoUrl = file ? this.resolveStoredPhotoPath(file) : null;

    return this.prisma.woundAssessment.create({
      data: {
        admissionId,
        nurseId: staffId,
        woundLocation: dto.woundLocation.trim(),
        woundSize: dto.woundSize.trim(),
        woundStage: dto.woundStage.trim(),
        exudate: dto.exudate.trim(),
        odor: dto.odor.trim(),
        infectionSigns: dto.infectionSigns.trim(),
        photoUrl,
      },
      include: { nurse: { select: nurseSelect } },
    });
  }

  async getPhotoFile(
    admissionId: string,
    assessmentId: string,
  ): Promise<{ filePath: string; fileName: string; mimeType: string }> {
    await assertAdmissionExists(this.prisma, admissionId);

    const assessment = await this.prisma.woundAssessment.findFirst({
      where: { id: assessmentId, admissionId },
    });
    if (!assessment) {
      throw new NotFoundException(
        `Wound assessment "${assessmentId}" not found.`,
      );
    }
    if (!assessment.photoUrl) {
      throw new NotFoundException('No photo for this wound assessment.');
    }

    const absolutePath = path.join(
      process.cwd(),
      'uploads',
      assessment.photoUrl,
    );
    if (!fs.existsSync(absolutePath)) {
      throw new NotFoundException('Photo file not found on disk.');
    }

    const ext = path.extname(assessment.photoUrl).toLowerCase();
    return {
      filePath: absolutePath,
      fileName: path.basename(assessment.photoUrl),
      mimeType: PHOTO_MIME_BY_EXT[ext] ?? 'application/octet-stream',
    };
  }

  private resolveStoredPhotoPath(file: Express.Multer.File): string {
    const filePath = (file as Express.Multer.File & { path?: string }).path;
    if (!filePath) {
      throw new BadRequestException('No photo file in request.');
    }

    const uploadsRoot = path.join(process.cwd(), 'uploads');
    return path.relative(uploadsRoot, filePath).split(path.sep).join('/');
  }
}
