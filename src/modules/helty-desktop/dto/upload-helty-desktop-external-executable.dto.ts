import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class UploadHeltyDesktopExternalExecutableDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  // Accepts either `toolname` or `toolname.exe`
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  description?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  password!: string;
}

