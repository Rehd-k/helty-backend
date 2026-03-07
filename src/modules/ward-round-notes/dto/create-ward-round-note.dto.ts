import {
  IsString,
  IsOptional,
  IsUUID,
  IsDateString,
  IsNotEmpty,
} from 'class-validator';

export class CreateWardRoundNoteDto {
  @IsUUID()
  @IsNotEmpty()
  admissionId: string;

  @IsUUID()
  @IsNotEmpty()
  doctorId: string;

  /** ISO date YYYY-MM-DD (calendar day of the round) */
  @IsDateString({ strict: true }, { message: 'roundDate must be YYYY-MM-DD' })
  @IsNotEmpty()
  roundDate: string;

  @IsString()
  @IsOptional()
  subjective?: string;

  @IsString()
  @IsOptional()
  objective?: string;

  @IsString()
  @IsOptional()
  assessment?: string;

  @IsString()
  @IsOptional()
  plan?: string;
}

/**
 * At least one of subjective, objective, assessment, plan must be non-empty.
 * Applied in controller/service via custom validator or pipe.
 */
export function hasAtLeastOneSoapField(dto: CreateWardRoundNoteDto): boolean {
  const s = (dto.subjective ?? '').trim();
  const o = (dto.objective ?? '').trim();
  const a = (dto.assessment ?? '').trim();
  const p = (dto.plan ?? '').trim();
  return s.length > 0 || o.length > 0 || a.length > 0 || p.length > 0;
}
