import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Request,
  StreamableFile,
  UploadedFiles,
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
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { createReadStream } from 'fs';
import { basename } from 'path';
import { AccountTypes } from '../../common/decorators';
import { PATIENT_ACCOUNT_TYPE } from '../patient-auth/patient-auth.constants';
import { PatientJwtPayload } from '../patient-auth/patient-auth.service';
import {
  CreateEmergencyRequestDto,
  ListEmergencyRequestQueryDto,
} from './dto/patient-emergency.dto';
import { PatientEmergencyService } from './patient-emergency.service';
import { EmergencyRequestStorageService } from './emergency-request-storage.service';

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

@ApiTags('patient-portal')
@Controller('patient')
export class PatientEmergencyController {
  constructor(
    private readonly patientEmergencyService: PatientEmergencyService,
    private readonly storage: EmergencyRequestStorageService,
  ) {}

  @Post('emergency-requests')
  @AccountTypes(PATIENT_ACCOUNT_TYPE)
  @ApiBearerAuth()
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
        voice: { type: 'string', format: 'binary' },
        video: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiOperation({ summary: 'Create an emergency services request' })
  @ApiResponse({ status: 201, description: 'Emergency request created' })
  create(
    @Request() req: { user: PatientJwtPayload },
    @Body() dto: CreateEmergencyRequestDto,
    @UploadedFiles()
    files: { voice?: Express.Multer.File[]; video?: Express.Multer.File[] },
  ) {
    const voice = files?.voice?.[0];
    const video = files?.video?.[0];
    if (voice && voice.size > MAX_VOICE_SIZE) {
      throw new BadRequestException('Voice file exceeds 5 MB limit');
    }
    return this.patientEmergencyService.create(req.user, dto, {
      voice,
      video,
    });
  }

  @Get('emergency-requests')
  @AccountTypes(PATIENT_ACCOUNT_TYPE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List my emergency requests' })
  list(
    @Request() req: { user: PatientJwtPayload },
    @Query() query: ListEmergencyRequestQueryDto,
  ) {
    return this.patientEmergencyService.list(req.user, query);
  }

  @Get('emergency-requests/:id/media/:kind')
  @AccountTypes(PATIENT_ACCOUNT_TYPE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Stream my emergency request voice or video' })
  async streamMedia(
    @Request() req: { user: PatientJwtPayload },
    @Param('id') id: string,
    @Param('kind') kind: string,
  ): Promise<StreamableFile> {
    if (kind !== 'voice' && kind !== 'video') {
      throw new BadRequestException('kind must be voice or video');
    }
    const request = await this.patientEmergencyService.get(req.user, id);
    const url = kind === 'voice' ? request.voiceUrl : request.videoUrl;
    if (!url) {
      throw new NotFoundException(`No ${kind} attached to this request.`);
    }
    const filePath = this.storage.resolvePath(id, url);
    const filename = basename(filePath);
    return new StreamableFile(createReadStream(filePath), {
      type: this.storage.contentTypeForFilename(filename),
      disposition: `inline; filename="${filename}"`,
    });
  }

  @Get('emergency-requests/:id')
  @AccountTypes(PATIENT_ACCOUNT_TYPE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get an emergency request' })
  get(@Request() req: { user: PatientJwtPayload }, @Param('id') id: string) {
    return this.patientEmergencyService.get(req.user, id);
  }

  @Patch('emergency-requests/:id/cancel')
  @AccountTypes(PATIENT_ACCOUNT_TYPE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancel a submitted emergency request' })
  cancel(
    @Request() req: { user: PatientJwtPayload },
    @Param('id') id: string,
  ) {
    return this.patientEmergencyService.cancel(req.user, id);
  }
}
