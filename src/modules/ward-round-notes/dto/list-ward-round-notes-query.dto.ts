import { IsOptional, IsUUID, IsDateString, IsNotEmpty } from 'class-validator';

export class ListWardRoundNotesQueryDto {
  /** Required: only notes for this admission */
  @IsUUID()
  @IsNotEmpty()
  admissionId: string;

  /** Optional: filter by doctor */
  @IsUUID()
  @IsOptional()
  doctorId?: string;

  /** Optional: filter from date (YYYY-MM-DD) */
  @IsDateString({ strict: true })
  @IsOptional()
  fromDate?: string;

  /** Optional: filter to date (YYYY-MM-DD) */
  @IsDateString({ strict: true })
  @IsOptional()
  toDate?: string;
}
