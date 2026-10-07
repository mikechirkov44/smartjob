import { GlobalRole, OrgRole } from '@prisma/client';

export type JwtPayload = {
  sub: string;
  email: string;
  globalRole: GlobalRole;
};

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  globalRole: GlobalRole;
};

export type RequestUser = AuthUser & {
  memberships: Array<{
    organizationId: string;
    role: OrgRole;
  }>;
};
