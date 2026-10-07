import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import { GlobalRole, OrgRole } from '@prisma/client';
import { RequestUser } from './auth.types';

export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

export const ROLES_KEY = 'roles';
export const Roles = (...roles: OrgRole[]) => SetMetadata(ROLES_KEY, roles);

export const SUPER_ADMIN_KEY = 'superAdmin';
export const SuperAdminOnly = () => SetMetadata(SUPER_ADMIN_KEY, true);

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RequestUser => {
    const request = ctx.switchToHttp().getRequest<{ user: RequestUser }>();
    return request.user;
  },
);

export const OrgId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      params: Record<string, string>;
      query: Record<string, string>;
    }>();
    return (
      request.headers['x-organization-id'] ||
      request.params.organizationId ||
      request.query.organizationId ||
      ''
    );
  },
);

export { GlobalRole, OrgRole };
