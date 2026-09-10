import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AccountType,
  HospitalAssetKind,
  HospitalAssetLogType,
  HospitalAssetStatus,
} from '@prisma/client';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class QueryHospitalAssetDto {
  @ApiPropertyOptional({ enum: AccountType })
  @IsOptional()
  @IsEnum(AccountType)
  accountType?: AccountType;

  @ApiPropertyOptional({ enum: HospitalAssetKind })
  @IsOptional()
  @IsEnum(HospitalAssetKind)
  kind?: HospitalAssetKind;

  @ApiPropertyOptional({ enum: HospitalAssetStatus })
  @IsOptional()
  @IsEnum(HospitalAssetStatus)
  status?: HospitalAssetStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  q?: string;
}

export class CreateHospitalAssetDto {
  @ApiProperty()
  @IsString()
  @MaxLength(200)
  name: string;

  @ApiProperty()
  @IsString()
  @MaxLength(80)
  assetTag: string;

  @ApiProperty({ enum: HospitalAssetKind })
  @IsEnum(HospitalAssetKind)
  kind: HospitalAssetKind;

  @ApiPropertyOptional({ enum: AccountType })
  @IsOptional()
  @IsEnum(AccountType)
  accountType?: AccountType;

  @ApiPropertyOptional({ enum: HospitalAssetStatus })
  @IsOptional()
  @IsEnum(HospitalAssetStatus)
  status?: HospitalAssetStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  serialNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  manufacturer?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  model?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  locationNote?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  acquiredAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateHospitalAssetDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @ApiPropertyOptional({ enum: HospitalAssetKind })
  @IsOptional()
  @IsEnum(HospitalAssetKind)
  kind?: HospitalAssetKind;

  @ApiPropertyOptional({ enum: HospitalAssetStatus })
  @IsOptional()
  @IsEnum(HospitalAssetStatus)
  status?: HospitalAssetStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  serialNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  manufacturer?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  model?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  locationNote?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  acquiredAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CreateHospitalAssetLogDto {
  @ApiProperty({ enum: HospitalAssetLogType })
  @IsEnum(HospitalAssetLogType)
  type: HospitalAssetLogType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ enum: HospitalAssetStatus })
  @IsOptional()
  @IsEnum(HospitalAssetStatus)
  toStatus?: HospitalAssetStatus;
}

export class TransferHospitalAssetDto {
  @ApiPropertyOptional({ enum: AccountType })
  @IsOptional()
  @IsEnum(AccountType)
  toAccountType?: AccountType;

  @ApiPropertyOptional({
    description: 'Other hospital / external destination',
  })
  @IsOptional()
  @IsString()
  transferredToNote?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}

export class UpsertHospitalAssetAccessDto {
  @ApiProperty()
  @IsUUID()
  staffId: string;

  @ApiPropertyOptional({ enum: AccountType })
  @IsOptional()
  @IsEnum(AccountType)
  accountType?: AccountType;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  canView?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  canLog?: boolean;
}
