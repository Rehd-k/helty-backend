import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UploadImshAndroidDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  version!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  password!: string;
}
