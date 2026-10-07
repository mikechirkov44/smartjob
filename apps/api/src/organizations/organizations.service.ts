import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { GlobalRole, OrgRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import {
  AddMemberDto,
  CreateOrganizationDto,
  UpdateMemberRoleDto,
  UpdateOrganizationDto,
} from './organizations.dto';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  listAll() {
    return this.prisma.organization.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { employees: true, surveys: true, members: true } },
      },
    });
  }

  async create(dto: CreateOrganizationDto) {
    const slug = dto.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const existing = await this.prisma.organization.findUnique({
      where: { slug },
    });
    if (existing) {
      throw new ConflictException('Организация с таким slug уже существует');
    }

    const email = dto.ownerEmail.toLowerCase();
    const passwordHash = await bcrypt.hash(dto.ownerPassword, 10);

    return this.prisma.$transaction(async (tx) => {
      let user = await tx.user.findUnique({ where: { email } });
      if (!user) {
        user = await tx.user.create({
          data: {
            email,
            name: dto.ownerName,
            passwordHash,
            globalRole: GlobalRole.USER,
          },
        });
      }

      const organization = await tx.organization.create({
        data: {
          name: dto.name,
          slug,
          industry: dto.industry || 'IT / Разработка ПО',
          members: {
            create: {
              userId: user.id,
              role: OrgRole.OWNER,
            },
          },
          departments: {
            create: [
              'Продукт',
              'Маркетинг',
              'Продажи',
              'HR',
              'Финансы',
              'IT',
              'Операции',
            ].map((name) => ({ name })),
          },
        },
        include: {
          members: { include: { user: true } },
          departments: true,
        },
      });

      return organization;
    });
  }

  async getOne(id: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id },
      include: {
        members: {
          include: {
            user: { select: { id: true, email: true, name: true } },
          },
        },
        _count: { select: { employees: true, surveys: true } },
      },
    });
    if (!org) {
      throw new NotFoundException('Организация не найдена');
    }
    return org;
  }

  async update(id: string, dto: UpdateOrganizationDto) {
    await this.getOne(id);
    return this.prisma.organization.update({
      where: { id },
      data: dto,
    });
  }

  async addMember(organizationId: string, dto: AddMemberDto) {
    await this.getOne(organizationId);
    const email = dto.email.toLowerCase();
    const passwordHash = await bcrypt.hash(dto.password, 10);

    return this.prisma.$transaction(async (tx) => {
      let user = await tx.user.findUnique({ where: { email } });
      if (!user) {
        user = await tx.user.create({
          data: {
            email,
            name: dto.name,
            passwordHash,
          },
        });
      }

      const existing = await tx.organizationMember.findUnique({
        where: {
          userId_organizationId: { userId: user.id, organizationId },
        },
      });
      if (existing) {
        throw new ConflictException('Пользователь уже в организации');
      }

      return tx.organizationMember.create({
        data: {
          userId: user.id,
          organizationId,
          role: dto.role,
        },
        include: {
          user: { select: { id: true, email: true, name: true } },
        },
      });
    });
  }

  async updateMemberRole(
    organizationId: string,
    memberId: string,
    dto: UpdateMemberRoleDto,
  ) {
    const member = await this.prisma.organizationMember.findFirst({
      where: { id: memberId, organizationId },
    });
    if (!member) {
      throw new NotFoundException('Участник не найден');
    }
    return this.prisma.organizationMember.update({
      where: { id: memberId },
      data: { role: dto.role },
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
    });
  }

  async removeMember(organizationId: string, memberId: string) {
    const member = await this.prisma.organizationMember.findFirst({
      where: { id: memberId, organizationId },
    });
    if (!member) {
      throw new NotFoundException('Участник не найден');
    }
    await this.prisma.organizationMember.delete({ where: { id: memberId } });
    return { ok: true };
  }
}
