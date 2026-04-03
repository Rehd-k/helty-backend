import {
  IsString,
  IsNumber,
  IsOptional,
  IsUUID,
  IsNotEmpty,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';

// ─── Service DTOs ──────────────────────────────────────────────────────────────

export class CreateServiceDto {
  @ApiProperty({
    description: 'Name of the hospital service',
    example: 'Blood Test',
  })
  @IsString()
  @IsNotEmpty()
  name: string | undefined;

  @ApiProperty({ description: 'The Service Code', example: 'CE90XXXXXXX' })
  @IsString()
  @IsNotEmpty()
  serviceCode: string | undefined;

  @ApiPropertyOptional({
    description: 'Brief description of the service',
    example: 'Full blood count (FBC)',
  })
  @IsString()
  @IsOptional()
  description?: string;

  @ApiProperty({ description: 'Cost of the service in naira', example: 3500 })
  @IsNumber()
  @Min(0)
  cost: number | undefined;

  @ApiPropertyOptional({ description: 'UUID of the service category' })
  @IsUUID()
  @IsOptional()
  categoryId?: string;

  @ApiPropertyOptional({
    description: 'UUID of the department offering this service',
  })
  @IsUUID()
  @IsOptional()
  departmentId?: string;
}

export class UpdateServiceDto extends PartialType(CreateServiceDto) {}
