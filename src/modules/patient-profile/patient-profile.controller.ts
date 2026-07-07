import { Body, Controller, Get, Put, Request } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AccountTypes } from '../../common/decorators';
import { PATIENT_ACCOUNT_TYPE } from '../patient-auth/patient-auth.constants';
import { PatientJwtPayload } from '../patient-auth/patient-auth.service';
import { UpdatePatientProfileDto } from './dto/update-patient-profile.dto';
import { PatientProfileService } from './patient-profile.service';

@ApiTags('patient-portal')
@Controller('patient')
export class PatientProfileController {
  constructor(private readonly patientProfileService: PatientProfileService) {}

  @Get('profile')
  @AccountTypes(PATIENT_ACCOUNT_TYPE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the authenticated patient profile' })
  @ApiResponse({ status: 200, description: 'Patient profile' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token' })
  @ApiResponse({
    status: 403,
    description: 'Staff token cannot access patient routes',
  })
  @ApiResponse({ status: 404, description: 'Patient not found' })
  getProfile(@Request() req: { user: PatientJwtPayload }) {
    return this.patientProfileService.getProfile(req.user);
  }

  @Put('profile')
  @AccountTypes(PATIENT_ACCOUNT_TYPE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update patient contact details' })
  @ApiResponse({ status: 200, description: 'Updated patient profile' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Missing or invalid token' })
  @ApiResponse({ status: 403, description: 'Patient cannot update this profile' })
  @ApiResponse({ status: 404, description: 'Patient not found' })
  updateProfile(
    @Request() req: { user: PatientJwtPayload },
    @Body() dto: UpdatePatientProfileDto,
  ) {
    return this.patientProfileService.updateProfile(req.user, dto);
  }
}
