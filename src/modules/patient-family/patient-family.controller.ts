import { Controller, Get, Request } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AccountTypes } from '../../common/decorators';
import { PATIENT_ACCOUNT_TYPE } from '../patient-auth/patient-auth.constants';
import { PatientJwtPayload } from '../patient-auth/patient-auth.service';
import { PatientFamilyService } from './patient-family.service';

@ApiTags('patient-portal')
@Controller('patient/family')
export class PatientFamilyController {
  constructor(private readonly patientFamilyService: PatientFamilyService) {}

  @Get()
  @AccountTypes(PATIENT_ACCOUNT_TYPE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List children linked to this patient (family)' })
  @ApiResponse({ status: 200, description: 'Family children list' })
  list(@Request() req: { user: PatientJwtPayload }) {
    return this.patientFamilyService.listChildren(req.user);
  }
}
