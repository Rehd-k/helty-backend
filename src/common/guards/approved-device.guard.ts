import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PatientDeviceStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  ACCOUNT_TYPES_KEY,
  ALLOW_PENDING_DEVICE_KEY,
  IS_PUBLIC_KEY,
  REQUIRE_APPROVED_DEVICE_KEY,
} from '../decorators';
import { PATIENT_ACCOUNT_TYPE } from '../../modules/patient-auth/patient-auth.constants';

export const DEVICE_PENDING_APPROVAL = 'DEVICE_PENDING_APPROVAL';

type PatientJwtUser = {
  sub?: string;
  deviceId?: string;
  accountType?: string;
};

@Injectable()
export class ApprovedDeviceGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic =
      this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? false;
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<{ user?: PatientJwtUser }>();
    const user = request.user;
    if (!user || user.accountType !== PATIENT_ACCOUNT_TYPE) {
      return true;
    }

    const allowedAccountTypes = this.reflector.getAllAndOverride<string[]>(
      ACCOUNT_TYPES_KEY,
      [context.getHandler(), context.getClass()],
    );
    const requireApprovedExplicit =
      this.reflector.getAllAndOverride<boolean>(REQUIRE_APPROVED_DEVICE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? false;

    const isPatientRoute =
      requireApprovedExplicit ||
      !!allowedAccountTypes?.includes(PATIENT_ACCOUNT_TYPE);

    if (!isPatientRoute) {
      return true;
    }

    if (!user.deviceId || !user.sub) {
      throw new UnauthorizedException({
        message: 'Device session required. Please log in again.',
        code: 'DEVICE_SESSION_REQUIRED',
      });
    }

    const device = await this.prisma.patientDevice.findUnique({
      where: { id: user.deviceId },
      select: {
        id: true,
        patientId: true,
        status: true,
      },
    });

    if (!device || device.patientId !== user.sub) {
      throw new UnauthorizedException({
        message: 'Device is no longer registered. Please log in again.',
        code: 'DEVICE_REVOKED',
      });
    }

    const allowPending =
      this.reflector.getAllAndOverride<boolean>(ALLOW_PENDING_DEVICE_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? false;

    if (
      device.status === PatientDeviceStatus.PENDING &&
      !allowPending
    ) {
      throw new ForbiddenException({
        message: 'Device is waiting for frontdesk approval.',
        code: DEVICE_PENDING_APPROVAL,
      });
    }

    return true;
  }
}
