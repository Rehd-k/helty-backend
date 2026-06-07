import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// ─── Service price line (per HMO + Service) ─────────────────────────────────

export class HmoServicePriceItemDto {
  @ApiProperty({ description: 'Hospital service UUID', format: 'uuid' })
  @IsUUID()
  serviceId!: string;

  @ApiPropertyOptional({
    description:
      'Simple HMO cost for this service. When provided, sets fullCost and hmoPays to this value and patientPays to 0.',
    example: 5000,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  cost?: number;

  @ApiPropertyOptional({
    description: 'Full / list price for this service under the HMO',
    example: 5000,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  fullCost?: number;

  @ApiPropertyOptional({ description: 'Amount covered by the HMO', example: 4000 })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  hmoPays?: number;

  @ApiPropertyOptional({
    description: 'Amount paid by the patient (co-pay)',
    example: 1000,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @IsOptional()
  patientPays?: number;

  @ApiPropertyOptional({
    description:
      'Optional per-service coverage percent override (0-100). When provided, overrides HMO default coverage for this service.',
    example: 50,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  coveragePercent?: number;
}

// ─── Create HMO ───────────────────────────────────────────────────────────────

export class CreateHmoDto {
  @ApiProperty({
    description: 'HMO / insurer display name',
    example: 'NHIS Standard Plan',
  })
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiPropertyOptional({
    description: 'Optional short code or policy family code',
  })
  @IsString()
  @IsOptional()
  code?: string;

  @ApiPropertyOptional({ description: 'Internal notes' })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({
    description:
      'Default coverage percent (0-100) applied at billing time when no per-service override exists.',
    example: 50,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  defaultCoveragePercent?: number;

  @ApiPropertyOptional({
    type: [HmoServicePriceItemDto],
    description: 'Per-service pricing for this HMO (use GET /services for IDs)',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HmoServicePriceItemDto)
  @IsOptional()
  servicePrices?: HmoServicePriceItemDto[];
}

// ─── Update HMO ───────────────────────────────────────────────────────────────

export class UpdateHmoDto {
  @ApiPropertyOptional({ description: 'HMO / insurer display name' })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  code?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiPropertyOptional({
    description: 'Default coverage percent (0-100)',
    example: 50,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  @IsOptional()
  defaultCoveragePercent?: number;

  @ApiPropertyOptional({
    type: [HmoServicePriceItemDto],
    description:
      'When provided, replaces all HMO service price rows with this set (upsert by serviceId).',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HmoServicePriceItemDto)
  @IsOptional()
  servicePrices?: HmoServicePriceItemDto[];
}

// ─── Upsert HMO service prices (merge) ────────────────────────────────────────

export class UpsertHmoServicePricesDto {
  @ApiProperty({
    type: [HmoServicePriceItemDto],
    description:
      'Service prices to upsert. Existing prices for other services are kept unchanged.',
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HmoServicePriceItemDto)
  servicePrices!: HmoServicePriceItemDto[];
}

// ─── Query list ───────────────────────────────────────────────────────────────

export class QueryHmoDto {
  @ApiPropertyOptional({
    description: 'Search by name or code (case-insensitive)',
    example: 'NHIS',
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ description: 'Pagination offset', example: 0 })
  @Type(() => Number)
  @IsOptional()
  skip?: number = 0;

  @ApiPropertyOptional({ description: 'Page size', example: 20 })
  @Type(() => Number)
  @IsOptional()
  take?: number = 20;
}

// ─── Patients under an HMO ────────────────────────────────────────────────────

export class QueryHmoPatientsDto {
  @ApiPropertyOptional({
    description: 'Search surname, first name, phone, patientId',
  })
  @IsString()
  @IsOptional()
  search?: string;

  @ApiPropertyOptional({ example: 0 })
  @Type(() => Number)
  @IsOptional()
  skip?: number = 0;

  @ApiPropertyOptional({ example: 20 })
  @Type(() => Number)
  @IsOptional()
  take?: number = 20;
}
