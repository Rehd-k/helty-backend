import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  AccountType,
  NursingUnit,
  StaffRole,
  WardType,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  isMatronRole,
  isNursingChargeOrMatron,
  staffRoleToNursingUnit,
} from './nursing.constants';
import { CONSULTATION_BILLING_CATEGORY } from '../invoice/invoice-link.constants';

export type NursingActor = {
  id: string;
  accountType?: string;
  staffRole?: string;
  departmentId?: string | null;
  wardId?: string | null;
};

const EMERGENCY_DEPARTMENT_NAMES = new Set([
  'emergency',
  'emmergency',
  'er',
  'a&e',
  'a and e',
  'accident',
  'accident and emergency',
]);

const ONG_DEPARTMENT_NAMES = new Set([
  'obstetrics',
  'gynaecology',
  'gynecology',
  'o&g',
  'obgyn',
  'maternity',
]);

const OPD_DEPARTMENT_NAMES = new Set([
  'opd',
  'outpatient',
  'out patient',
  'out-patient',
]);

function normalizeDeptName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s*&\s*/g, '&');
}

export function wardMatchesNursingUnit(
  ward: { type: WardType; name: string; department?: { name: string } | null },
  unit: NursingUnit,
): boolean {
  const wardName = normalizeDeptName(ward.name);
  const deptName = ward.department?.name
    ? normalizeDeptName(ward.department.name)
    : '';

  switch (unit) {
    case NursingUnit.ICU:
      return ward.type === WardType.ICU;
    case NursingUnit.INPATIENT_WARD:
      return ward.type !== WardType.ICU && !OPD_DEPARTMENT_NAMES.has(wardName);
    case NursingUnit.EMERGENCY:
      return (
        EMERGENCY_DEPARTMENT_NAMES.has(wardName) ||
        EMERGENCY_DEPARTMENT_NAMES.has(deptName)
      );
    case NursingUnit.OPD:
      return OPD_DEPARTMENT_NAMES.has(wardName) || OPD_DEPARTMENT_NAMES.has(deptName);
    case NursingUnit.ONG:
      return ONG_DEPARTMENT_NAMES.has(wardName) || ONG_DEPARTMENT_NAMES.has(deptName);
    default:
      return false;
  }
}

export function assertCanManageNursingUnit(
  actor: NursingActor,
  nursingUnit: NursingUnit,
): void {
  if (isMatronRole(actor.staffRole)) return;

  const actorUnit = staffRoleToNursingUnit(actor.staffRole);
  if (!actorUnit || actorUnit !== nursingUnit) {
    throw new ForbiddenException(
      `You may only manage the ${actorUnit ?? 'assigned'} nursing unit.`,
    );
  }
}

export async function assertCanManageWard(
  prisma: PrismaService,
  actor: NursingActor,
  wardId: string,
): Promise<{ ward: { id: string; type: WardType; name: string; departmentId: string | null } }> {
  if (isMatronRole(actor.staffRole)) {
    const ward = await prisma.ward.findUnique({
      where: { id: wardId },
      select: { id: true, type: true, name: true, departmentId: true },
    });
    if (!ward) throw new NotFoundException(`Ward "${wardId}" not found.`);
    return { ward };
  }

  const actorUnit = staffRoleToNursingUnit(actor.staffRole);
  if (!actorUnit) {
    throw new ForbiddenException(
      'Only charge nurses or the matron may manage ward assignments.',
    );
  }

  const ward = await prisma.ward.findUnique({
    where: { id: wardId },
    select: {
      id: true,
      type: true,
      name: true,
      departmentId: true,
      department: { select: { name: true } },
    },
  });
  if (!ward) throw new NotFoundException(`Ward "${wardId}" not found.`);

  if (!wardMatchesNursingUnit(ward, actorUnit)) {
    throw new ForbiddenException(
      'This ward is outside your nursing unit scope.',
    );
  }

  return { ward: { id: ward.id, type: ward.type, name: ward.name, departmentId: ward.departmentId } };
}

export async function resolveNursingUnitForAdmission(
  prisma: PrismaService,
  admissionId: string,
): Promise<NursingUnit> {
  const admission = await prisma.admission.findUnique({
    where: { id: admissionId },
    select: {
      wardEntity: {
        select: {
          type: true,
          name: true,
          department: { select: { name: true } },
        },
      },
    },
  });
  if (!admission?.wardEntity) {
    return NursingUnit.INPATIENT_WARD;
  }

  const ward = admission.wardEntity;
  if (wardMatchesNursingUnit(ward, NursingUnit.ICU)) return NursingUnit.ICU;
  if (wardMatchesNursingUnit(ward, NursingUnit.EMERGENCY)) return NursingUnit.EMERGENCY;
  if (wardMatchesNursingUnit(ward, NursingUnit.ONG)) return NursingUnit.ONG;
  return NursingUnit.INPATIENT_WARD;
}

export async function assertCanManageAdmission(
  prisma: PrismaService,
  actor: NursingActor,
  admissionId: string,
): Promise<NursingUnit> {
  const unit = await resolveNursingUnitForAdmission(prisma, admissionId);
  if (isMatronRole(actor.staffRole)) return unit;

  const actorUnit = staffRoleToNursingUnit(actor.staffRole);
  if (!actorUnit) {
    throw new ForbiddenException(
      'Only charge nurses or the matron may manage patient assignments.',
    );
  }

  const inpatientUnits: NursingUnit[] = [
    NursingUnit.INPATIENT_WARD,
    NursingUnit.ICU,
    NursingUnit.EMERGENCY,
    NursingUnit.ONG,
  ];
  if (!inpatientUnits.includes(actorUnit)) {
    throw new ForbiddenException(
      'Your role cannot manage inpatient patient assignments.',
    );
  }

  if (actorUnit !== unit && !(actorUnit === NursingUnit.ONG && unit === NursingUnit.ONG)) {
    throw new ForbiddenException(
      'This admission is outside your nursing unit scope.',
    );
  }

  return unit;
}

export async function assertCanManageOutpatientUnit(
  actor: NursingActor,
  nursingUnit: NursingUnit,
): Promise<void> {
  if (nursingUnit !== NursingUnit.OPD && nursingUnit !== NursingUnit.ONG) {
    throw new ForbiddenException(
      'Outpatient assignments are only valid for OPD or O&G units.',
    );
  }
  assertCanManageNursingUnit(actor, nursingUnit);
}

export async function assertInvoiceInNursingQueue(
  prisma: PrismaService,
  invoiceId: string,
): Promise<void> {
  const invoice = await prisma.invoice.findFirst({
    where: {
      id: invoiceId,
      status: 'PAID',
      patient: {
        patientId: { not: null },
        NOT: { patientId: '' },
      },
      invoiceItems: {
        some: {
          settled: false,
          service: {
            category: {
              name: { equals: CONSULTATION_BILLING_CATEGORY, mode: 'insensitive' },
            },
          },
        },
      },
    },
    select: { id: true },
  });
  if (!invoice) {
    throw new NotFoundException(
      'Invoice not found in the active nursing queue.',
    );
  }
}

export async function loadNursingActor(
  prisma: PrismaService,
  staffId: string,
): Promise<NursingActor> {
  const staff = await prisma.staff.findUnique({
    where: { id: staffId },
    select: {
      id: true,
      accountType: true,
      staffRole: true,
      departmentId: true,
      wardId: true,
      isActive: true,
    },
  });
  if (!staff || !staff.isActive) {
    throw new ForbiddenException('Staff profile not found or inactive.');
  }
  return staff;
}

export function assertActorCanManageRoster(actor: NursingActor): void {
  if (!isNursingChargeOrMatron(actor.staffRole)) {
    throw new ForbiddenException(
      'Only charge nurses or the matron may manage shift rosters.',
    );
  }
}

export const NURSING_ACCOUNT_TYPE_ROLES: ReadonlySet<StaffRole> = new Set([
  StaffRole.MATRON,
  StaffRole.WARD_CHARGE_NURSE,
  StaffRole.ICU_CHARGE_NURSE,
  StaffRole.EMERGENCY_CHARGE_NURSE,
  StaffRole.OPD_CHARGE_NURSE,
  StaffRole.ONG_CHARGE_NURSE,
  StaffRole.INPATIENT_NURSE,
  StaffRole.OUTPATIENT_NURSE,
  StaffRole.EMERGENCY_NURSE,
  StaffRole.ICU_NURSE,
  StaffRole.ONG_NURSE,
]);
