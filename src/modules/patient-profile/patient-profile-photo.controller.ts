import {
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Post,
  Request,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AccountTypes } from '../../common/decorators';
import { PATIENT_ACCOUNT_TYPE } from '../patient-auth/patient-auth.constants';
import { PatientJwtPayload } from '../patient-auth/patient-auth.service';
import { PatientProfilePhotoService } from './patient-profile-photo.service';

const MAX_PHOTO_SIZE = 5 * 1024 * 1024;

const ALLOWED_PHOTO_MIMES = ['image/jpeg', 'image/png', 'image/webp'];

const photoInterceptor = FileInterceptor('photo', {
  storage: memoryStorage(),
  limits: { fileSize: MAX_PHOTO_SIZE },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_PHOTO_MIMES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'), false);
    }
  },
});

@ApiTags('patient-portal')
@Controller('patient')
export class PatientProfilePhotoController {
  constructor(
    private readonly patientProfilePhotoService: PatientProfilePhotoService,
  ) {}

  @Post('profile/photo')
  @AccountTypes(PATIENT_ACCOUNT_TYPE)
  @ApiBearerAuth()
  @UseInterceptors(photoInterceptor)
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['photo'],
      properties: {
        photo: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiOperation({ summary: 'Upload or replace patient profile photo' })
  @ApiResponse({ status: 200, description: 'Updated patient profile' })
  @ApiResponse({ status: 400, description: 'Invalid or missing photo' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token' })
  @ApiResponse({ status: 403, description: 'Staff token cannot upload photos' })
  @ApiResponse({ status: 413, description: 'File exceeds size limit' })
  uploadPhoto(
    @Request() req: { user: PatientJwtPayload },
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.patientProfilePhotoService.uploadPhoto(req.user, file);
  }

  @Delete('profile/photo')
  @AccountTypes(PATIENT_ACCOUNT_TYPE)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove patient profile photo' })
  @ApiResponse({ status: 200, description: 'Updated patient profile' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token' })
  @ApiResponse({ status: 403, description: 'Staff token cannot delete photos' })
  deletePhoto(@Request() req: { user: PatientJwtPayload }) {
    return this.patientProfilePhotoService.deletePhoto(req.user);
  }
}
