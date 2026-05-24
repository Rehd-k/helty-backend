import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsUUID,
  IsBoolean,
  IsInt,
  IsEnum,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { LabTestFieldType } from '@prisma/client';

export class CreateLabTestFieldDto {
  @ApiProperty({ description: 'Lab test version UUID' })
  @IsUUID()
  @IsNotEmpty()
  testVersionId: string;

  @ApiProperty({ description: 'Field label' })
  @IsString()
  @IsNotEmpty()
  label: string;

  @ApiProperty({ enum: LabTestFieldType, description: 'Field type' })
  @IsEnum(LabTestFieldType)
  fieldType: LabTestFieldType;

  @ApiPropertyOptional({ description: 'Unit (e.g. g/dL)' })
  @IsString()
  @IsOptional()
  unit?: string;

  @ApiPropertyOptional({
    description:
      'Reference range for NUMBER fields. Supported: closed interval "80-120", less-than "<1.2", less-or-equal "<=1.2" or "≤1.2", greater-than ">5", greater-or-equal ">=5" or "≥5". Spaces and en-dashes are allowed.',
  })
  @IsString()
  @IsOptional()
  referenceRange?: string;

  @ApiPropertyOptional({ description: 'Required', default: false })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  required?: boolean;

  @ApiPropertyOptional({ description: 'Display position', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  position?: number;

  @ApiPropertyOptional({
    description:
      'JSON string for DROPDOWN/MULTISELECT options (e.g. ["A","B"] or [{"value":"a","label":"A"}] )',
  })
  @IsString()
  @IsOptional()
  optionsJson?: string;
}
