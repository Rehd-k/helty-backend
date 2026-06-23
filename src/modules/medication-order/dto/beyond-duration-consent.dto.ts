import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Min, ValidateIf } from 'class-validator';
import { RxDurationUnit } from '@prisma/client';

export class BeyondDurationConsentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  consentNote?: string;

  @ApiPropertyOptional()
  @ValidateIf((dto) => dto.extendDurationUnit != null)
  @IsInt()
  @Min(1)
  extendDurationValue?: number;

  @ApiPropertyOptional({ enum: RxDurationUnit })
  @ValidateIf((dto) => dto.extendDurationValue != null)
  @IsEnum(RxDurationUnit)
  extendDurationUnit?: RxDurationUnit;
}
