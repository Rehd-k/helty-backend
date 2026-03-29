import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UploadHeltyDesktopDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  version!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  password!: string;
}
