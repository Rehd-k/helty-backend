import { IsOptional, IsUUID, IsIn } from 'class-validator';

/** Query params for GET /admissions. status=admitted maps to ACTIVE. */
export class ListAdmissionsQueryDto {
  @IsOptional()
  skip?: string;

  @IsOptional()
  take?: string;

  @IsOptional()
  @IsIn([
    'admitted',
    'ACTIVE',
    'PENDING_BILLING_CLEARANCE',
    'DISCHARGED',
    'TRANSFERRED',
    'DECEASED',
  ])
  status?: string;

  @IsOptional()
  @IsUUID()
  attendingDoctorId?: string;
}
