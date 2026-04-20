import {
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { AccountType, AdmissionStatus, StaffRole } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

/** Matches AccessGuard: either field may mark the platform super-admin. */
export function isSuperAdminStaff(staff: {
  accountType: AccountType;
  staffRole: StaffRole;
}): boolean {
  return (
    staff.accountType === AccountType.SUPER_ADMIN ||
    staff.staffRole === StaffRole.SUPER_ADMIN
  );
}

export async function assertAdmissionExists(
  prisma: PrismaService,
  admissionId: string,
) {
  const admission = await prisma.admission.findUnique({
    where: { id: admissionId },
    select: { id: true, status: true },
  });
  if (!admission) {
    throw new NotFoundException(`Admission "${admissionId}" not found.`);
  }
  return admission;
}

/** Block writes when admission is no longer active (optional strictness). */
export function assertAdmissionWritable(admission: {
  status: AdmissionStatus;
}) {
  if (admission.status !== AdmissionStatus.ACTIVE) {
    throw new ForbiddenException(
      'This admission is not active; nursing actions are not allowed.',
    );
  }
}

/**
 * Ensure the given Staff exists, is active, and has the NURSE account type.
 * Returns the Staff's id, which is the value stored in nurseId / administeredByNurseId.
 */
export async function assertStaffIsNurseOrThrow(
  prisma: PrismaService,
  staffId: string,
) {
  const staff = await prisma.staff.findUnique({
    where: { id: staffId },
    select: {
      id: true,
      accountType: true,
      staffRole: true,
      isActive: true,
    },
  });
  if (!staff) {
    throw new ForbiddenException('Signed-in staff profile not found.');
  }
  if (!staff.isActive) {
    throw new ForbiddenException('Staff account is inactive.');
  }
  if (isSuperAdminStaff(staff)) {
    return staff;
  }
  if (staff.accountType !== AccountType.NURSE) {
    throw new ForbiddenException(
      'Only staff with the NURSE account type can perform this action.',
    );
  }
  return staff;
}

/**
 * Ensure the target staff (e.g. for a NurseAssignment payload) is a nurse.
 * Allows assigning any NURSE regardless of sub-role (HEAD_NURSE, INPATIENT_NURSE, OUTPATIENT_NURSE).
 */
export async function assertTargetStaffIsNurseOrThrow(
  prisma: PrismaService,
  staffId: string,
) {
  const staff = await prisma.staff.findUnique({
    where: { id: staffId },
    select: {
      id: true,
      accountType: true,
      isActive: true,
    },
  });
  if (!staff) {
    throw new NotFoundException(`Staff "${staffId}" not found.`);
  }
  if (!staff.isActive) {
    throw new ForbiddenException(`Staff "${staffId}" is inactive.`);
  }
  if (staff.accountType !== AccountType.NURSE) {
    throw new ForbiddenException(
      `Staff "${staffId}" is not a nurse (accountType must be NURSE).`,
    );
  }
  return staff;
}
