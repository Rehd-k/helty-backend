import {
  IsOptional,
  IsUUID,
  IsString,
  IsBoolean,
  IsEnum,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { SortOrder } from '../../../../common/dto/sort-order.dto';

export enum LabInvestigationsSortBy {
  createdAt = 'createdAt',
  testName = 'testName',
  amount = 'amount',
  patientName = 'patientName',
  status = 'status',
}

export { SortOrder };

export class LabInvestigationsQueryDto {
  @ApiPropertyOptional({ description: 'Start date (ISO 8601). Defaults to today.' })
  @IsOptional()
  @IsString()
  fromDate?: string;

  @ApiPropertyOptional({ description: 'End date (ISO 8601). Defaults to today.' })
  @IsOptional()
  @IsString()
  toDate?: string;

  @ApiPropertyOptional({ description: 'Partial match on test name (e.g. CBC, HIV)' })
  @IsOptional()
  @IsString()
  testName?: string;

  @ApiPropertyOptional({ description: 'Filter by lab test category UUID' })
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @ApiPropertyOptional({ description: 'Filter by item or request status' })
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional({ description: 'Filter by sample collected state' })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true' || value === true) return true;
    if (value === 'false' || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  sampleCollected?: boolean;

  @ApiPropertyOptional({
    description: 'Service department UUID or patient ward UUID',
  })
  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @ApiPropertyOptional({ enum: LabInvestigationsSortBy, default: 'createdAt' })
  @IsOptional()
  @IsEnum(LabInvestigationsSortBy)
  sortBy?: LabInvestigationsSortBy = LabInvestigationsSortBy.createdAt;

  @ApiPropertyOptional({ enum: SortOrder, default: 'desc' })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder = SortOrder.desc;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number = 0;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number = 20;
}
