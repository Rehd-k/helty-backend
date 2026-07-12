import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Res,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../../common/decorators';
import { PatientPhotoStorageService } from './patient-photo-storage.service';

@ApiTags('patient-portal')
@Controller('uploads/patients')
export class PatientAvatarController {
  constructor(private readonly photoStorage: PatientPhotoStorageService) {}

  @Public()
  @Get(':patientId/avatar.jpg')
  @ApiOperation({ summary: 'Serve patient profile photo (public)' })
  @ApiResponse({ status: 200, description: 'Avatar image' })
  @ApiResponse({ status: 404, description: 'Avatar not found' })
  serveAvatar(@Param('patientId') patientId: string, @Res() res: Response) {
    const filePath = this.photoStorage.resolveAvatarPath(patientId);
    if (!filePath) {
      throw new NotFoundException('Avatar not found');
    }

    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('Content-Type', 'image/jpeg');
    return res.sendFile(filePath);
  }
}
