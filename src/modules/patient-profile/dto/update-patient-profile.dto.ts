import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdatePatientProfileDto {
  @ApiPropertyOptional({ example: 'emem.okon@example.com' })
  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @ApiPropertyOptional({ example: '+2348012345678' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  phoneNumber?: string;

  @ApiPropertyOptional({ example: '12 Hospital Road, Uyo, Akwa Ibom' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  addressOfResidence?: string;
}
