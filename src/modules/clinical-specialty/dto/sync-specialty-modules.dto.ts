import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MedicalSpecialty } from '@prisma/client';
import {
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class SpecialtyModuleInputDto {
  @ApiProperty({ enum: MedicalSpecialty })
  @IsEnum(MedicalSpecialty)
  specialty: MedicalSpecialty;

  @ApiProperty({
    description: 'Enabled section keys for this specialty on this encounter',
    example: ['cardiology.ecg', 'cardiology.echocardiogram'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  enabledSectionKeys: string[];
}

export class SyncSpecialtyModulesDto {
  @ApiProperty({
    type: [SpecialtyModuleInputDto],
    description:
      'Full replacement set for this encounter. Empty array removes all specialty modules and section data.',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SpecialtyModuleInputDto)
  modules: SpecialtyModuleInputDto[];

  @ApiPropertyOptional({
    description:
      'Optional reason for amending a completed encounter (stored in edit history)',
  })
  @IsOptional()
  @IsString()
  editReason?: string;
}
