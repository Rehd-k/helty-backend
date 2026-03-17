import { IsString, IsNotEmpty } from 'class-validator';

export class CreateMedicalHistoryDto {
  @IsString()
  @IsNotEmpty()
  patientId: string;

  @IsString()
  @IsNotEmpty()
  details: string;
}

export class UpdateMedicalHistoryDto {
  @IsString()
  @IsNotEmpty()
  details: string;
}
