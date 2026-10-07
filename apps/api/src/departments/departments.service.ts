import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  list(organizationId: string) {
    return this.prisma.department.findMany({
      where: { organizationId },
      orderBy: { name: 'asc' },
      include: { _count: { select: { employees: true } } },
    });
  }

  async create(organizationId: string, name: string) {
    try {
      return await this.prisma.department.create({
        data: { organizationId, name: name.trim() },
      });
    } catch {
      throw new ConflictException('Отдел с таким названием уже существует');
    }
  }

  async update(organizationId: string, id: string, name: string) {
    const dept = await this.prisma.department.findFirst({
      where: { id, organizationId },
    });
    if (!dept) {
      throw new NotFoundException('Отдел не найден');
    }
    return this.prisma.department.update({
      where: { id },
      data: { name: name.trim() },
    });
  }

  async remove(organizationId: string, id: string) {
    const dept = await this.prisma.department.findFirst({
      where: { id, organizationId },
    });
    if (!dept) {
      throw new NotFoundException('Отдел не найден');
    }
    await this.prisma.department.delete({ where: { id } });
    return { ok: true };
  }
}
