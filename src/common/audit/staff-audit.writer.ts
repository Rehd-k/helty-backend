import { Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { staffAuditAls } from './staff-audit.context';
import {
  describeStaffWrite,
  type StaffWriteEvent,
} from './staff-audit.describe';

const logger = new Logger('StaffAudit');

type AuditClient = {
  auditLog: {
    create: (args: { data: Prisma.AuditLogCreateInput }) => Promise<unknown>;
  };
  auditTrail: {
    create: (args: { data: Prisma.AuditTrailCreateInput }) => Promise<unknown>;
  };
};

export async function persistStaffWrite(
  client: AuditClient,
  event: StaffWriteEvent,
): Promise<void> {
  const store = staffAuditAls.getStore();
  if (!store?.staffId) return;
  const described = describeStaffWrite(event);
  if (!described) return;

  try {
    await client.auditLog.create({
      data: {
        entity: described.entity,
        entityId: described.entityId,
        action: described.action,
        summary: described.summary,
        route: store.route,
        httpMethod: store.method,
        ipAddress: store.ip,
        staffRole: store.staffRole,
        accountType: store.accountType,
        departmentName: store.departmentName,
        oldValue: jsonOrUndefined(described.oldValue),
        newValue: jsonOrUndefined(described.newValue),
        performedBy: { connect: { id: store.staffId } },
      },
    });
  } catch (err) {
    logger.error(`Audit log write failed: ${errorMessage(err)}`);
  }

  if (!described.admissionId || !described.trailAction) return;
  if (described.entityId.startsWith('batch')) return;

  try {
    await client.auditTrail.create({
      data: {
        entityName: described.entity,
        entityId: described.entityId,
        actionType: described.trailAction,
        performedBy: { connect: { id: store.staffId } },
        admission: { connect: { id: described.admissionId } },
        previousValue: jsonOrUndefined(described.oldValue),
        newValue: jsonOrUndefined(described.newValue),
      },
    });
  } catch (err) {
    logger.error(`Audit trail write failed: ${errorMessage(err)}`);
  }
}

function jsonOrUndefined(
  value: Record<string, unknown> | undefined,
): Prisma.InputJsonValue | undefined {
  if (!value) return undefined;
  return value as Prisma.InputJsonValue;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
