import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY, ROLES_KEY } from '../decorators';

const ADMIN_ROLE = 'admin';

@Injectable()
export class AccessGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic =
      this.reflector.get<boolean>(IS_PUBLIC_KEY, context.getHandler()) ??
      this.reflector.get<boolean>(IS_PUBLIC_KEY, context.getClass());
    if (isPublic) return true;

    const user = context.switchToHttp().getRequest().user;
    if (!user) {
      throw new UnauthorizedException();
    }

    if (user.role?.toLowerCase() === ADMIN_ROLE) {
      return true;
    }

    const allowedRoles =
      this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
        context.getHandler(),
        context.getClass(),
      ]);
    if (!allowedRoles?.length) return true;

    const hasRole = allowedRoles.some(
      (r) => r?.toLowerCase() === user.role?.toLowerCase(),
    );
    if (!hasRole) {
      throw new ForbiddenException('Access denied');
    }

    return true;
  }
}
