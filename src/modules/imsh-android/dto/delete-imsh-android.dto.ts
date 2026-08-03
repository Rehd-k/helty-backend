import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class DeleteImshAndroidDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  password!: string;
}
