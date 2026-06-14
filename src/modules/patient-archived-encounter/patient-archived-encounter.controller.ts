import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { nanoid } from 'nanoid';
import type { Response } from 'express';
import { JwtAuthGuard, AccessGuard } from '../../common/guards';
import { AccountTypes } from '../../common/decorators';
import { PatientArchivedEncounterService } from './patient-archived-encounter.service';
import { CreateArchivedEncounterDto } from './dto/create-archived-encounter.dto';

const MAX_FILE_SIZE =
  Number(process.env.PATIENT_ARCHIVE_MAX_FILE_BYTES) || 50 * 1024 * 1024;

const ALLOWED_MIMES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
];

const archiveFilesInterceptor = FilesInterceptor('files', 20, {
  storage: diskStorage({
    destination: (req, _file, cb) => {
      const patientId = req.params?.patientId;
      const id = Array.isArray(patientId) ? patientId[0] : patientId;
      if (!id) {
        return cb(new Error('patientId required'), '');
      }
      try {
        const dir = PatientArchivedEncounterService.stagingDirForPatient(id);
        cb(null, dir);
      } catch (err) {
        cb(err as Error, '');
      }
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || '.bin';
      cb(null, `${nanoid()}${ext}`);
    },
  }),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    const mime = file.mimetype?.toLowerCase();
    if (mime && !ALLOWED_MIMES.includes(mime)) {
      return cb(
        new Error(
          'File type not allowed. Use image (JPEG, PNG, GIF, WebP) or PDF.',
        ),
        false,
      );
    }
    cb(null, true);
  },
});

const ARCHIVE_UPLOAD_ROLES = [
  'FRONT_DESK',
  'OUTPATIENT_NURSE',
  'ONG_NURSE',
  'MEDICAL_RECORDS',
  'CONSULTANT',
  'RESIDENT',
  'INTERN',
  'JUNIOR_RESIDENT',
  'SENIOR_RESIDENT',
  'CHIEF_RESIDENT',
  'CMD',
  'CMAC',
  'ADMIN',
] as const;

@ApiTags('Patient – Archived encounters')
@Controller('patients')
@UseGuards(JwtAuthGuard, AccessGuard)
export class PatientArchivedEncounterController {
  constructor(
    private readonly archivedEncounterService: PatientArchivedEncounterService,
  ) {}

  @Get('archived-encounters/documents/:documentId/file')
  @ApiOperation({ summary: 'Download an archived encounter document' })
  async downloadFile(
    @Param('documentId') documentId: string,
    @Res() res: Response,
  ) {
    const { filePath, fileName, mimeType } =
      await this.archivedEncounterService.getDocumentFile(documentId);
    if (mimeType) {
      res.setHeader('Content-Type', mimeType);
    }
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${fileName.replace(/"/g, '')}"`,
    );
    res.sendFile(filePath);
  }

  @Delete('archived-encounters/documents/:documentId')
  @AccountTypes(...ARCHIVE_UPLOAD_ROLES)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete an archived encounter document' })
  removeDocument(@Param('documentId') documentId: string) {
    return this.archivedEncounterService.removeDocument(documentId);
  }

  @Post(':patientId/archived-encounters')
  @AccountTypes(...ARCHIVE_UPLOAD_ROLES)
  @UseInterceptors(archiveFilesInterceptor)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Upload scanned documents for a historical encounter',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['encounterOccurredAt', 'files'],
      properties: {
        encounterOccurredAt: {
          type: 'string',
          format: 'date-time',
          description: 'When the original visit occurred',
        },
        title: { type: 'string' },
        notes: { type: 'string' },
        files: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
    },
  })
  upload(
    @Param('patientId') patientId: string,
    @Body() dto: CreateArchivedEncounterDto,
    @UploadedFiles() files: Express.Multer.File[],
    @Req() req: { user: { sub: string } },
  ) {
    return this.archivedEncounterService.createWithFiles(
      patientId,
      dto,
      files ?? [],
      req.user.sub,
    );
  }

  @Get(':patientId/archived-encounters')
  @ApiOperation({ summary: 'List archived encounter groups for a patient' })
  list(@Param('patientId') patientId: string) {
    return this.archivedEncounterService.listByPatient(patientId);
  }
}
