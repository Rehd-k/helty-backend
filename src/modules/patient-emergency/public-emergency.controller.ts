import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { Public } from '../../common/decorators';
import { CreateGuestEmergencyRequestDto } from './dto/patient-emergency.dto';
import { EmergencyRequestStorageService } from './emergency-request-storage.service';
import { PatientEmergencyService } from './patient-emergency.service';

const MAX_VOICE_SIZE = 5 * 1024 * 1024;
const MAX_VIDEO_SIZE = 25 * 1024 * 1024;

const emergencyFilesInterceptor = FileFieldsInterceptor(
  [
    { name: 'voice', maxCount: 1 },
    { name: 'video', maxCount: 1 },
  ],
  {
    storage: memoryStorage(),
    limits: { fileSize: MAX_VIDEO_SIZE },
    fileFilter: (_req, file, cb) => {
      const storage = new EmergencyRequestStorageService();
      const kind = file.fieldname === 'voice' ? 'voice' : 'video';
      if (!storage.isAllowedMime(kind, file.mimetype)) {
        cb(new Error(`Invalid ${kind} file type`), false);
        return;
      }
      cb(null, true);
    },
  },
);

@ApiTags('public')
@Controller('public')
export class PublicEmergencyController {
  constructor(
    private readonly patientEmergencyService: PatientEmergencyService,
  ) {}

  @Post('emergency-requests')
  @Public()
  @UseInterceptors(emergencyFilesInterceptor)
  @ApiConsumes('multipart/form-data')
  @HttpCode(HttpStatus.CREATED)
  @ApiBody({
    schema: {
      type: 'object',
      required: ['latitude', 'longitude'],
      properties: {
        latitude: { type: 'number' },
        longitude: { type: 'number' },
        accuracyMeters: { type: 'number' },
        addressText: { type: 'string' },
        description: { type: 'string' },
        guestName: { type: 'string' },
        guestPhone: { type: 'string' },
        voice: { type: 'string', format: 'binary' },
        video: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiOperation({
    summary: 'Create an emergency request without signing in (guest caller)',
  })
  @ApiResponse({ status: 201, description: 'Emergency request created' })
  create(
    @Body() dto: CreateGuestEmergencyRequestDto,
    @UploadedFiles()
    files: { voice?: Express.Multer.File[]; video?: Express.Multer.File[] },
  ) {
    const voice = files?.voice?.[0];
    const video = files?.video?.[0];
    if (voice && voice.size > MAX_VOICE_SIZE) {
      throw new BadRequestException('Voice file exceeds 5 MB limit');
    }
    return this.patientEmergencyService.createGuest(dto, { voice, video });
  }
}
