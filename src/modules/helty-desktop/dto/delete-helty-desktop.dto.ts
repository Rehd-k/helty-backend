import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class DeleteHeltyDesktopDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  password!: string;
}
