import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { isAllowedHealthImageUrl } from '../health-content-image.storage';

function toOptionalBoolean({ value }: { value: unknown }): boolean | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  return undefined;
}

function trimToString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function trimToNullable({ value }: { value: unknown }): unknown {
  if (value == null) return value;
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

@ValidatorConstraint({ name: 'isHealthImageUrl', async: false })
class IsHealthImageUrlConstraint implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (value == null || value === '') return true;
    return typeof value === 'string' && isAllowedHealthImageUrl(value);
  }

  defaultMessage(): string {
    return 'Image must be an http(s) URL or an uploaded infographic.';
  }
}

export class CreateHealthCampaignDto {
  @ApiPropertyOptional({
    description: 'Optional when an image carries the message',
  })
  @Transform(trimToString)
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({
    description: 'Optional when an image carries the message',
  })
  @Transform(trimToString)
  @IsOptional()
  @IsString()
  body?: string;

  @ApiPropertyOptional({ nullable: true })
  @Transform(trimToNullable)
  @IsOptional()
  @Validate(IsHealthImageUrlConstraint)
  imageUrl?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  publishedAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class UpdateHealthCampaignDto extends PartialType(
  CreateHealthCampaignDto,
) {}

export class CreateHealthNewsArticleDto {
  @ApiPropertyOptional({
    description: 'Optional when an image carries the message',
  })
  @Transform(trimToString)
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({
    description: 'Optional when an image carries the message',
  })
  @Transform(trimToString)
  @IsOptional()
  @IsString()
  body?: string;

  @ApiPropertyOptional({ nullable: true })
  @Transform(trimToNullable)
  @IsOptional()
  @Validate(IsHealthImageUrlConstraint)
  imageUrl?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  publishedAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}

export class UpdateHealthNewsArticleDto extends PartialType(
  CreateHealthNewsArticleDto,
) {}

export class ListHealthContentQueryDto {
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

  @ApiPropertyOptional({
    description: 'Staff only: filter by publish state',
  })
  @IsOptional()
  @Transform(toOptionalBoolean)
  @IsBoolean()
  isPublished?: boolean;
}
