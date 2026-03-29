import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY, ROLES_KEY, ACCOUNT_TYPES_KEY } from '../decorators';

type JwtUser = {
  accountType?: string;
  staffRole?: string;
  role?: string;
};

/** Trainee / ward physician roles (legacy "INPATIENT_DOCTOR" token). */
const PHYSICIAN_TRAINEE_ROLES = new Set([
  'RESIDENT',
  'INTERN',
  'JUNIOR_RESIDENT',
  'SENIOR_RESIDENT',
  'CHIEF_RESIDENT',
]);

/**
 * Route metadata lists legacy flat tokens from the old enum and/or new
 * accountType / StaffRole values. A match on either JWT field or legacy alias grants access.
 */
function accountTypeTokenMatches(token: string, user: JwtUser): boolean {
  if (user.accountType === token || user.staffRole === token) {
    return true;
  }
  switch (token) {
    case 'INPATIENT_DOCTOR':
      return (
        user.accountType === 'PHYSICIAN' &&
        !!user.staffRole &&
        PHYSICIAN_TRAINEE_ROLES.has(user.staffRole)
      );
    case 'CONSULTANT':
      return user.staffRole === 'CONSULTANT';
    case 'RADIOLOGIST':
      return user.staffRole === 'RADIOLOGY_HEAD';
    case 'RADIOLOGY':
      return user.accountType === 'RADIOLOGY';
    case 'LAB':
      return user.accountType === 'LABORATORY';
    case 'NURSE':
      return user.accountType === 'NURSE';
    case 'PHARMACY':
      return user.accountType === 'PHARMACY';
    case 'ACCOUNTS':
      return user.accountType === 'ACCOUNTING';
    case 'BILLS':
      return user.accountType === 'BILLING';
    case 'FRONTDESK':
      return (
        user.accountType === 'FRONT_DESK' && user.staffRole === 'FRONT_DESK'
      );
    case 'MEDICAL_RECORDS':
      return (
        user.accountType === 'MEDICAL_RECORDS' &&
        user.staffRole === 'MEDICAL_RECORDS'
      );
    case 'STORE':
      return user.accountType === 'STORE';
    case 'ONG':
      return (
        user.accountType === 'PHYSICIAN' &&
        user.staffRole !== 'MEDICAL_STUDENT'
      );
    case 'THEATERE':
      return (
        user.accountType === 'PHYSICIAN' ||
        user.staffRole === 'HEAD_NURSE' ||
        user.staffRole === 'INPATIENT_NURSE'
      );
    case 'DIALYSIS':
      return user.accountType === 'PHYSICIAN';
    default:
      return false;
  }
}

@Injectable()
export class AccessGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic =
      this.reflector.get<boolean>(IS_PUBLIC_KEY, context.getHandler()) ??
      this.reflector.get<boolean>(IS_PUBLIC_KEY, context.getClass());
    if (isPublic) return true;

    const user = context.switchToHttp().getRequest().user as JwtUser;
    if (!user) {
      throw new UnauthorizedException();
    }

    if (
      user.staffRole === 'SUPER_ADMIN' ||
      user.accountType === 'SUPER_ADMIN'
    ) {
      return true;
    }

    const allowedAccountTypes = this.reflector.getAllAndOverride<string[]>(
      ACCOUNT_TYPES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (allowedAccountTypes?.length) {
      const ok = allowedAccountTypes.some((t) => accountTypeTokenMatches(t, user));
      if (!ok) {
        throw new ForbiddenException(
          'Access denied: requires one of account types ' +
            allowedAccountTypes.join(', '),
        );
      }
      return true;
    }

    const allowedRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!allowedRoles?.length) return true;

    const hasRole = allowedRoles.some((r) => {
      const rl = r?.toLowerCase();
      if (rl === 'admin') {
        return (
          user.staffRole === 'SUPER_ADMIN' || user.accountType === 'SUPER_ADMIN'
        );
      }
      if (rl === 'doctor') return user.accountType === 'PHYSICIAN';
      if (rl === 'nurse') return user.accountType === 'NURSE';
      if (rl === 'laboratory') return user.accountType === 'LABORATORY';
      if (rl === 'radiology') return user.accountType === 'RADIOLOGY';
      return rl === user.role?.toLowerCase();
    });
    if (!hasRole) {
      throw new ForbiddenException('Access denied');
    }

    return true;
  }
}
