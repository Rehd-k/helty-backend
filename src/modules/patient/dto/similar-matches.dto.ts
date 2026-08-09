import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class SimilarMatchesQueryDto {
  @ApiProperty({ example: 'Ada' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  firstName: string;

  @ApiProperty({ example: 'Okafor' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  surname: string;

  @ApiPropertyOptional({ example: 'Chioma' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  otherName?: string;

  @ApiProperty({ example: '1990-05-12' })
  @IsDateString()
  dob: string;
}

export class SimilarMatchesBodyDto extends SimilarMatchesQueryDto {}

export class MergePatientsDto {
  @ApiProperty({ description: 'Patient record that survives the merge' })
  @IsUUID()
  survivorId: string;

  @ApiProperty({ description: 'Duplicate patient record to absorb and delete' })
  @IsUUID()
  duplicateId: string;
}

/** Shared boolean transform for query/body forceCreate flags. */
export function transformForceCreateFlag({
  value,
}: {
  value: unknown;
}): boolean | undefined {
  if (value === 'true' || value === true) return true;
  if (value === 'false' || value === false) return false;
  return undefined;
}

export class ForceCreateQueryDto {
  @ApiPropertyOptional({
    description:
      'When true, skip similar-match conflict and create even if candidates exist (phone uniqueness still enforced).',
  })
  @IsOptional()
  @Transform(transformForceCreateFlag)
  @IsBoolean()
  forceCreate?: boolean;
}
