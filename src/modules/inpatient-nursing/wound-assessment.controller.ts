import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { nanoid } from 'nanoid';
import type { Response } from 'express';
import { JwtAuthGuard, AccessGuard } from '../../common/guards';
import { AccountTypes } from '../../common/decorators';
import { WoundAssessmentService } from './wound-assessment.service';
import { CreateWoundAssessmentDto } from './dto/nursing-docs.dto';

const MAX_PHOTO_SIZE = 50 * 1024 * 1024; // 50 MB

const ALLOWED_PHOTO_MIMES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
];

const woundPhotoInterceptor = FileInterceptor('file', {
  storage: diskStorage({
    destination: (req, _file, cb) => {
      const admissionId = req.params?.admissionId;
      const id = Array.isArray(admissionId) ? admissionId[0] : admissionId;
      if (!id) {
        return cb(new Error('admissionId required'), '');
      }
      const dir = WoundAssessmentService.uploadDirForAdmission(id);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || '.bin';
      cb(null, `${nanoid()}${ext}`);
    },
  }),
  limits: { fileSize: MAX_PHOTO_SIZE },
  fileFilter: (_req, file, cb) => {
    const mime = file.mimetype?.toLowerCase();
    if (mime && !ALLOWED_PHOTO_MIMES.includes(mime)) {
      return cb(
        new Error(
          'File type not allowed. Use image (JPEG, PNG, GIF, WebP).',
        ),
        false,
      );
    }
    cb(null, true);
  },
});

@ApiTags('Inpatient — wound assessments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, AccessGuard)
@Controller('admissions/:admissionId/wound-assessments')
export class WoundAssessmentController {
  constructor(private readonly service: WoundAssessmentService) {}

  @Get()
  @AccountTypes('NURSE', 'HEAD_NURSE', 'INPATIENT_DOCTOR', 'CONSULTANT')
  @ApiOperation({ summary: 'List wound assessments' })
  list(@Param('admissionId') admissionId: string) {
    return this.service.list(admissionId);
  }

  @Get(':assessmentId/photo')
  @AccountTypes('NURSE', 'HEAD_NURSE', 'INPATIENT_DOCTOR', 'CONSULTANT')
  @ApiOperation({ summary: 'Serve wound assessment photo' })
  async getPhoto(
    @Param('admissionId') admissionId: string,
    @Param('assessmentId') assessmentId: string,
    @Res() res: Response,
  ) {
    const { filePath, fileName, mimeType } = await this.service.getPhotoFile(
      admissionId,
      assessmentId,
    );
    res.setHeader('Content-Type', mimeType);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(fileName)}"`,
    );
    res.sendFile(filePath);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @AccountTypes('NURSE', 'HEAD_NURSE')
  @UseInterceptors(woundPhotoInterceptor)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Create wound assessment' })
  @ApiBody({
    schema: {
      type: 'object',
      required: [
        'woundLocation',
        'woundSize',
        'woundStage',
        'exudate',
        'odor',
        'infectionSigns',
      ],
      properties: {
        woundLocation: { type: 'string' },
        woundSize: { type: 'string' },
        woundStage: { type: 'string' },
        exudate: { type: 'string' },
        odor: { type: 'string' },
        infectionSigns: { type: 'string' },
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  create(
    @Param('admissionId') admissionId: string,
    @Body() dto: CreateWoundAssessmentDto,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() req: { user: { sub: string } },
  ) {
    return this.service.create(admissionId, dto, req.user.sub, file);
  }
}
