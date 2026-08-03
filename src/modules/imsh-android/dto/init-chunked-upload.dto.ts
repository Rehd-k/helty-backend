import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class InitChunkedUploadDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  password!: string;

  /** Only `release` is supported for IMSH Android APKs. */
  @IsString()
  @IsIn(['release'])
  kind!: 'release';

  @IsOptional()
  @IsString()
  @MaxLength(64)
  version?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500 * 1024 * 1024)
  totalBytes!: number;

  /** Preferred chunk size from client (bytes). Server may clamp. */
  @Type(() => Number)
  @IsInt()
  @Min(256 * 1024)
  @Max(8 * 1024 * 1024)
  chunkSize!: number;
}
