import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Req,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { nanoid } from 'nanoid';
import { JwtAuthGuard, AccessGuard } from '../../common/guards';
import { AccountTypes } from '../../common/decorators';
import { RadiologyImageService } from './radiology-image.service';
// import * as express from 'express';

const UPLOAD_BASE = path.join(process.cwd(), 'uploads', 'radiology');
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

const radiologyFileInterceptor = FileInterceptor('file', {
  storage: diskStorage({
    destination: (req, _file, cb) => {
      const requestId = req.params?.requestId;
      const id = Array.isArray(requestId) ? requestId[0] : requestId;
      if (!id) {
        return cb(new Error('requestId required'), '');
      }
      const dir = path.join(UPLOAD_BASE, id);
      fs.mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname) || '.bin';
      cb(null, `${nanoid()}${ext}`);
    },
  }),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'application/pdf',
    ];
    const mime = file.mimetype?.toLowerCase();
    if (mime && !allowed.includes(mime)) {
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

@ApiTags('Radiology – Images')
@Controller('radiology')
@UseGuards(JwtAuthGuard, AccessGuard)
@AccountTypes(
  'CONSULTANT',
  'INPATIENT_DOCTOR',
  'RADIOLOGIST',
  'RADIOGRAPHER',
  'RADIOLOGY',
)
export class RadiologyImageController {
  constructor(private readonly radiologyImageService: RadiologyImageService) {}

  @Post('requests/:requestId/images')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(radiologyFileInterceptor)
  @ApiOperation({ summary: 'Upload an image/file for a radiology request' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  upload(
    @Param('requestId') requestId: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: { user?: { sub?: string } },
  ) {
    const uploadedById = req.user?.sub;
    if (!uploadedById) {
      throw new Error('Unauthorized');
    }
    return this.radiologyImageService.upload(requestId, file, uploadedById);
  }

  @Get('requests/:requestId/images')
  @ApiOperation({ summary: 'List images for a radiology request' })
  list(@Param('requestId') requestId: string) {
    return this.radiologyImageService.listByRequestId(requestId);
  }

  @Get('images/:id/file')
  @ApiOperation({ summary: 'Download/serve image file' })
  async getFile(@Param('id') id: string, @Res() res: any) {
    const { filePath, fileName, mimeType } =
      await this.radiologyImageService.getFile(id);
    res.setHeader('Content-Type', mimeType || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(fileName)}"`,
    );
    res.sendFile(filePath);
  }

  @Delete('images/:id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete an image and its file' })
  remove(@Param('id') id: string) {
    return this.radiologyImageService.remove(id);
  }
}
