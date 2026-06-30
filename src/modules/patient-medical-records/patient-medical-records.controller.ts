import { Controller, Get, Param, Query, Request } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AccountTypes } from '../../common/decorators';
import { PATIENT_ACCOUNT_TYPE } from '../patient-auth/patient-auth.constants';
import { PatientJwtPayload } from '../patient-auth/patient-auth.service';
import {
  EncounterDetailDto,
  EncounterListResponseDto,
} from './dto/encounter-response.dto';
import { ListMedicalRecordsQueryDto } from './dto/list-medical-records-query.dto';
import { PatientMedicalRecordsService } from './patient-medical-records.service';

@ApiTags('patient-portal')
@Controller('patient')
export class PatientMedicalRecordsController {
  constructor(
    private readonly patientMedicalRecordsService: PatientMedicalRecordsService,
  ) {}

  @Get('medical-records')
  @AccountTypes(PATIENT_ACCOUNT_TYPE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List patient medical records (encounters)' })
  @ApiResponse({ status: 200, type: EncounterListResponseDto })
  @ApiResponse({ status: 403, description: 'Staff token cannot access patient routes' })
  listMedicalRecords(
    @Request() req: { user: PatientJwtPayload },
    @Query() query: ListMedicalRecordsQueryDto,
  ) {
    return this.patientMedicalRecordsService.listMedicalRecords(
      req.user,
      query,
    );
  }

  @Get('medical-records/:id')
  @AccountTypes(PATIENT_ACCOUNT_TYPE)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a single patient medical record (encounter)' })
  @ApiResponse({ status: 200, type: EncounterDetailDto })
  @ApiResponse({ status: 404, description: 'Medical record not found' })
  @ApiResponse({ status: 403, description: 'Staff token cannot access patient routes' })
  getEncounter(
    @Request() req: { user: PatientJwtPayload },
    @Param('id') id: string,
  ) {
    return this.patientMedicalRecordsService.getEncounter(req.user, id);
  }
}
