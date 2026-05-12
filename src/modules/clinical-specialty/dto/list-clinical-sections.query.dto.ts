import { ApiPropertyOptional } from '@nestjs/swagger';
import { MedicalSpecialty } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class ListClinicalSectionsQueryDto {
  @ApiPropertyOptional({ enum: MedicalSpecialty })
  @IsOptional()
  @IsEnum(MedicalSpecialty)
  specialty?: MedicalSpecialty;

  @ApiPropertyOptional({
    description: 'Comma-separated section keys to filter (must match specialty if set)',
    example: 'cardiology.ecg,cardiology.echocardiogram',
  })
  @IsOptional()
  @IsString()
  keys?: string;
}
