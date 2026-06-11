import {
  Body,
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  Put,
  Query,
  Req,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { MedicalSpecialty } from '@prisma/client';
import { AccountTypes } from '../../common/decorators';
import { NURSING_ACCESS } from '../nursing/nursing.constants';
import { EncounterSpecialtyService } from './encounter-specialty.service';
import { SyncSpecialtyModulesDto } from './dto/sync-specialty-modules.dto';
import { UpsertClinicalSectionDto } from './dto/upsert-clinical-section.dto';
import { ListClinicalSectionsQueryDto } from './dto/list-clinical-sections.query.dto';

@ApiTags('Encounter clinical specialties')
@Controller('encounters')
export class EncounterSpecialtyController {
  constructor(private readonly encounterSpecialtyService: EncounterSpecialtyService) {}

  @Get(':id/specialty-modules')
  @AccountTypes(
    'ONG',
    'CONSULTANT',
    'INPATIENT_DOCTOR',
    ...NURSING_ACCESS,
    'MEDICAL_RECORDS',
    'CMD',
    'CMAC',
    'SUPER_ADMIN',
  )
  @ApiOperation({ summary: 'List specialty modules configured for an encounter' })
  listModules(@Param('id') encounterId: string) {
    return this.encounterSpecialtyService.listModules(encounterId);
  }

  @Put(':id/specialty-modules')
  @AccountTypes('ONG', 'CONSULTANT', 'INPATIENT_DOCTOR', 'CMD', 'CMAC', 'SUPER_ADMIN')
  @ApiOperation({
    summary: 'Sync specialty modules (full replacement per encounter)',
    description:
      'Replaces the encounter’s specialty module set. Removes modules (and their section data) not present in the body. Trims clinical section rows when a section key is disabled.',
  })
  syncModules(
    @Param('id') encounterId: string,
    @Body() dto: SyncSpecialtyModulesDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.encounterSpecialtyService.syncModules(
      encounterId,
      dto,
      req.user.sub,
    );
  }

  @Get(':id/clinical-sections')
  @AccountTypes(
    'ONG',
    'CONSULTANT',
    'INPATIENT_DOCTOR',
    ...NURSING_ACCESS,
    'MEDICAL_RECORDS',
    'CMD',
    'CMAC',
    'SUPER_ADMIN',
  )
  @ApiOperation({ summary: 'List clinical section JSON documents for an encounter' })
  listSections(
    @Param('id') encounterId: string,
    @Query() query: ListClinicalSectionsQueryDto,
  ) {
    return this.encounterSpecialtyService.listClinicalSections(encounterId, query);
  }

  @Put(':id/clinical-sections/:specialty/:sectionKey')
  @AccountTypes('ONG', 'CONSULTANT', 'INPATIENT_DOCTOR', 'CMD', 'CMAC', 'SUPER_ADMIN')
  @ApiOperation({
    summary: 'Create or replace one clinical section payload',
    description:
      'Section must be enabled on the encounter via PUT .../specialty-modules. Replaces stored data with the request body.',
  })
  upsertSection(
    @Param('id') encounterId: string,
    @Param('specialty', new ParseEnumPipe(MedicalSpecialty)) specialty: MedicalSpecialty,
    @Param('sectionKey') sectionKey: string,
    @Body() dto: UpsertClinicalSectionDto,
    @Req() req: { user: { sub: string } },
  ) {
    return this.encounterSpecialtyService.upsertClinicalSection(
      encounterId,
      specialty,
      sectionKey,
      dto,
      req.user.sub,
    );
  }
}
