import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AccountTypes } from '../../common/decorators';
import { PatientClinicalRecordsService } from './patient-clinical-records.service';
import {
  CreatePatientAllergyDto,
  UpdatePatientAllergyDto,
} from './dto/patient-allergy.dto';
import {
  CreatePatientImmunizationDto,
  UpdatePatientImmunizationDto,
} from './dto/patient-immunization.dto';

const CLINICAL_RECORD_WRITE_ACCESS = ['NURSE', 'MEDICAL_RECORDS'] as const;

@ApiTags('Patient clinical records')
@ApiBearerAuth()
@Controller('patients/:patientId')
export class PatientClinicalRecordsController {
  constructor(
    private readonly clinicalRecords: PatientClinicalRecordsService,
  ) {}

  @Get('allergies')
  @ApiOperation({ summary: 'List patient allergies' })
  listAllergies(@Param('patientId') patientId: string) {
    return this.clinicalRecords.listAllergies(patientId);
  }

  @Post('allergies')
  @HttpCode(HttpStatus.CREATED)
  @AccountTypes(...CLINICAL_RECORD_WRITE_ACCESS)
  @ApiOperation({ summary: 'Add a patient allergy' })
  createAllergy(
    @Param('patientId') patientId: string,
    @Body() dto: CreatePatientAllergyDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.clinicalRecords.createAllergy(patientId, dto, req.user.sub);
  }

  @Patch('allergies/:allergyId')
  @AccountTypes(...CLINICAL_RECORD_WRITE_ACCESS)
  @ApiOperation({ summary: 'Update a patient allergy' })
  updateAllergy(
    @Param('patientId') patientId: string,
    @Param('allergyId') allergyId: string,
    @Body() dto: UpdatePatientAllergyDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.clinicalRecords.updateAllergy(
      patientId,
      allergyId,
      dto,
      req.user.sub,
    );
  }

  @Delete('allergies/:allergyId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @AccountTypes(...CLINICAL_RECORD_WRITE_ACCESS)
  @ApiOperation({ summary: 'Delete a patient allergy' })
  removeAllergy(
    @Param('patientId') patientId: string,
    @Param('allergyId') allergyId: string,
  ) {
    return this.clinicalRecords.removeAllergy(patientId, allergyId);
  }

  @Get('immunizations')
  @ApiOperation({ summary: 'List patient immunizations' })
  listImmunizations(@Param('patientId') patientId: string) {
    return this.clinicalRecords.listImmunizations(patientId);
  }

  @Post('immunizations')
  @HttpCode(HttpStatus.CREATED)
  @AccountTypes(...CLINICAL_RECORD_WRITE_ACCESS)
  @ApiOperation({ summary: 'Add a patient immunization' })
  createImmunization(
    @Param('patientId') patientId: string,
    @Body() dto: CreatePatientImmunizationDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.clinicalRecords.createImmunization(
      patientId,
      dto,
      req.user.sub,
    );
  }

  @Patch('immunizations/:immunizationId')
  @AccountTypes(...CLINICAL_RECORD_WRITE_ACCESS)
  @ApiOperation({ summary: 'Update a patient immunization' })
  updateImmunization(
    @Param('patientId') patientId: string,
    @Param('immunizationId') immunizationId: string,
    @Body() dto: UpdatePatientImmunizationDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.clinicalRecords.updateImmunization(
      patientId,
      immunizationId,
      dto,
      req.user.sub,
    );
  }

  @Delete('immunizations/:immunizationId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @AccountTypes(...CLINICAL_RECORD_WRITE_ACCESS)
  @ApiOperation({ summary: 'Delete a patient immunization' })
  removeImmunization(
    @Param('patientId') patientId: string,
    @Param('immunizationId') immunizationId: string,
  ) {
    return this.clinicalRecords.removeImmunization(patientId, immunizationId);
  }
}
