import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AccountTypes } from '../../common/decorators';
import { EncounterSpecialtyService } from './encounter-specialty.service';

@ApiTags('Clinical specialties')
@Controller('clinical')
export class ClinicalSpecialtyCatalogController {
  constructor(private readonly encounterSpecialtyService: EncounterSpecialtyService) {}

  @Get('specialties')
  @AccountTypes(
    'ONG',
    'CONSULTANT',
    'INPATIENT_DOCTOR',
    'NURSE',
    'HEAD_NURSE',
    'MEDICAL_RECORDS',
    'CMD',
    'CMAC',
    'SUPER_ADMIN',
  )
  @ApiOperation({
    summary: 'Specialty & section catalog for dynamic encounter forms',
    description:
      'Static registry (v1) listing each MedicalSpecialty and allowed section keys with labels and example payloads.',
  })
  getSpecialties() {
    return this.encounterSpecialtyService.getCatalog();
  }
}
