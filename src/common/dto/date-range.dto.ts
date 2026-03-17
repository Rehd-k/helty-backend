import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  Min,
} from 'class-validator';

export class DateRangeQueryDto {
  @ApiProperty({
    description: 'Start date (ISO 8601). Will be normalized to start-of-day.',
  })
  @IsOptional()
  @IsDateString()
  fromDate!: string;

  @ApiProperty({
    description: 'End date (ISO 8601). Will be normalized to end-of-day.',
  })
  @IsOptional()
  @IsDateString()
  toDate!: string;
}

export class DateRangeSkipTakeDto extends DateRangeQueryDto {
  @ApiProperty({ required: false, default: 0, minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number = 0;

  @ApiProperty({ required: false, default: 20, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  take?: number = 20;
}
