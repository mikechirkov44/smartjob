import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { GlobalRole, OrgRole } from '@prisma/client';
import { IS_PUBLIC_KEY, ROLES_KEY, SUPER_ADMIN_KEY } from './decorators';
import { RequestUser } from './auth.types';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    return super.canActivate(context);
  }
}

@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<boolean>(SUPER_ADMIN_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) {
      return true;
    }
    const request = context.switchToHttp().getRequest<{ user?: RequestUser }>();
    if (request.user?.globalRole !== GlobalRole.SUPER_ADMIN) {
      throw new ForbiddenException('Требуются права супер-администратора');
    }
    return true;
  }
}

const ROLE_RANK: Record<OrgRole, number> = {
  VIEWER: 1,
  HR: 2,
  ADMIN: 3,
  OWNER: 4,
};

@Injectable()
export class OrgRolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<OrgRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!roles?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      user?: RequestUser;
      headers: Record<string, string | undefined>;
      params: Record<string, string>;
      query: Record<string, string>;
    }>();

    const user = request.user;
    if (!user) {
      throw new UnauthorizedException();
    }
    if (user.globalRole === GlobalRole.SUPER_ADMIN) {
      return true;
    }

    const organizationId =
      request.headers['x-organization-id'] ||
      request.params.organizationId ||
      request.query.organizationId;

    if (!organizationId) {
      throw new ForbiddenException('Не указана организация');
    }

    const membership = user.memberships.find(
      (m) => m.organizationId === organizationId,
    );
    if (!membership) {
      throw new ForbiddenException('Нет доступа к организации');
    }

    const userRank = ROLE_RANK[membership.role];
    const minRank = Math.min(...roles.map((r) => ROLE_RANK[r]));
    if (userRank < minRank) {
      throw new ForbiddenException('Недостаточно прав');
    }
    return true;
  }
}
