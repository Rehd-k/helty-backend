import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsInt,
  IsPositive,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

// ─── Create Bank ──────────────────────────────────────────────────────────────

export class CreateBankDto {
  @ApiProperty({
    description: 'Display name of the bank account',
    example: 'GTBank - Operations',
  })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({
    description: 'Bank account number (must be unique)',
    example: '0123456789',
  })
  @IsString()
  @IsNotEmpty()
  accountNumber!: string;
}

// ─── Update Bank ──────────────────────────────────────────────────────────────

export class UpdateBankDto {
  @ApiPropertyOptional({ description: 'Updated display name' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    description: 'Updated account number (must be unique)',
  })
  @IsString()
  @IsOptional()
  accountNumber?: string;
}

// ─── Query Banks ──────────────────────────────────────────────────────────────

export class QueryBankDto {
  @ApiPropertyOptional({
    description: 'Free-text search across bank name and account number',
    example: 'GTBank',
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: 'Number of records to skip', example: 0 })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @IsOptional()
  skip?: number = 0;

  @ApiPropertyOptional({
    description: 'Number of records to return',
    example: 20,
  })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @IsOptional()
  take?: number = 20;
}
