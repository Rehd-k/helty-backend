import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  ACCOUNT_TYPES_KEY,
  DEPARTMENTS_KEY,
  ROLES_KEY,
  IS_PUBLIC_KEY,
} from '../decorators/index';

@Injectable()
export class AccessGuard implements CanActivate {
  constructor(private reflector: Reflector) { }

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.get<boolean>(IS_PUBLIC_KEY, context.getHandler());
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException();
    }

    // default admin-only
    if (user.role === 'admin' || user.role === 'ADMIN') {
      return true;
    }

    const roles = this.reflector.get<string[]>(ROLES_KEY, context.getHandler());
    if (roles && roles.length) {
      if (roles.includes(user.role)) {
        return true;
      }
    }

    const departments = this.reflector.get<string[]>(DEPARTMENTS_KEY, context.getHandler());
    if (departments && departments.length) {
      if (departments.includes(user.department)) {
        return true;
      }
      // department head has extra privilege
      if (user.department && user.departmentHead) {
        // we assume user.departmentHead is boolean computed in token
        if (departments.includes(user.department)) {
          return true;
        }
      }
    }

    const accountTypes = this.reflector.get<string[]>(ACCOUNT_TYPES_KEY, context.getHandler());
    if (accountTypes && accountTypes.length) {
      if (accountTypes.includes(user.accountType)) {
        return true;
      }
    }

    throw new ForbiddenException('Access denied');
  }
}
