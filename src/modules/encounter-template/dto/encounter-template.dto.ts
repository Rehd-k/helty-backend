import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsEnum,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { EncounterType } from '@prisma/client';

export class EncounterTemplateClinicalFieldsDto {
  @ApiPropertyOptional({ description: 'Chief complaint prefill' })
  @IsString()
  @IsOptional()
  chiefComplaint?: string;

  @ApiPropertyOptional({ description: 'History of present illness' })
  @IsString()
  @IsOptional()
  hpi?: string;

  @ApiPropertyOptional({ description: 'Past medical history' })
  @IsString()
  @IsOptional()
  pmh?: string;

  @ApiPropertyOptional({ description: 'Surgical history' })
  @IsString()
  @IsOptional()
  surgicalHistory?: string;

  @ApiPropertyOptional({ description: 'Drug / medication history' })
  @IsString()
  @IsOptional()
  drugHistory?: string;

  @ApiPropertyOptional({ description: 'Allergy history' })
  @IsString()
  @IsOptional()
  allergyHistory?: string;

  @ApiPropertyOptional({ description: 'Family history' })
  @IsString()
  @IsOptional()
  familyHistory?: string;

  @ApiPropertyOptional({ description: 'Social history' })
  @IsString()
  @IsOptional()
  socialHistory?: string;

  @ApiPropertyOptional({ description: 'Physical examination notes' })
  @IsString()
  @IsOptional()
  examinationNotes?: string;

  @ApiPropertyOptional({ description: 'SOAP — subjective' })
  @IsString()
  @IsOptional()
  soapSubjective?: string;

  @ApiPropertyOptional({ description: 'SOAP — objective' })
  @IsString()
  @IsOptional()
  soapObjective?: string;

  @ApiPropertyOptional({ description: 'SOAP — assessment' })
  @IsString()
  @IsOptional()
  soapAssessment?: string;

  @ApiPropertyOptional({ description: 'SOAP — plan' })
  @IsString()
  @IsOptional()
  soapPlan?: string;

  @ApiPropertyOptional({ description: 'Triage notes' })
  @IsString()
  @IsOptional()
  triageNotes?: string;

  @ApiPropertyOptional({ description: 'Visit type label, e.g. OPD or Follow-up' })
  @IsString()
  @IsOptional()
  visitType?: string;

  @ApiPropertyOptional({ description: 'Primary ICD-10 code' })
  @IsString()
  @IsOptional()
  primaryIcdCode?: string;

  @ApiPropertyOptional({ description: 'Primary ICD-10 description' })
  @IsString()
  @IsOptional()
  primaryIcdDescription?: string;

  @ApiPropertyOptional({
    description: 'JSON array of { code, description } secondary diagnoses',
  })
  @IsString()
  @IsOptional()
  secondaryDiagnosesJson?: string;

  @ApiPropertyOptional({
    description:
      'JSON array of procedures (same shape as encounter proceduresJson)',
  })
  @IsString()
  @IsOptional()
  proceduresJson?: string;

  @ApiPropertyOptional({
    description:
      'JSON array of { specialty, enabledSectionKeys: string[] } for specialty modules',
  })
  @IsString()
  @IsOptional()
  specialtyModulesJson?: string;

  @ApiPropertyOptional({
    description:
      'JSON array of { specialty, sectionKey, schemaVersion?, data } for clinical sections',
  })
  @IsString()
  @IsOptional()
  clinicalSectionsJson?: string;

  @ApiPropertyOptional({ description: 'Follow-up date (free text or ISO date)' })
  @IsString()
  @IsOptional()
  followUpDate?: string;

  @ApiPropertyOptional({ description: 'Follow-up instructions' })
  @IsString()
  @IsOptional()
  followUpInstructions?: string;

  @ApiPropertyOptional({ description: 'Referral notes' })
  @IsString()
  @IsOptional()
  referral?: string;
}

export class CreateEncounterTemplateDto extends EncounterTemplateClinicalFieldsDto {
  @ApiProperty({ description: 'Template display name (unique per doctor)' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional({ description: 'Short description of when to use this template' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    enum: EncounterType,
    description: 'Suggested encounter type when applying this template',
  })
  @IsEnum(EncounterType)
  @IsOptional()
  encounterType?: EncounterType;
}

export class UpdateEncounterTemplateDto extends PartialType(
  CreateEncounterTemplateDto,
) {}

export class QueryEncounterTemplateDto {
  @ApiPropertyOptional({
    enum: EncounterType,
    description: 'Filter templates by suggested encounter type',
  })
  @IsEnum(EncounterType)
  @IsOptional()
  encounterType?: EncounterType;
}
