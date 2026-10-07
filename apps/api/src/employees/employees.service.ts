import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateEmployeeDto,
  ImportEmployeesDto,
  UpdateEmployeeDto,
} from './employees.dto';

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  list(organizationId: string) {
    return this.prisma.employee.findMany({
      where: { organizationId },
      orderBy: { fullName: 'asc' },
      include: { department: true },
    });
  }

  create(organizationId: string, dto: CreateEmployeeDto) {
    return this.prisma.employee.create({
      data: {
        organizationId,
        fullName: dto.fullName.trim(),
        email: dto.email?.toLowerCase(),
        departmentId: dto.departmentId || null,
        grade: dto.grade,
      },
      include: { department: true },
    });
  }

  async update(organizationId: string, id: string, dto: UpdateEmployeeDto) {
    const emp = await this.prisma.employee.findFirst({
      where: { id, organizationId },
    });
    if (!emp) {
      throw new NotFoundException('Сотрудник не найден');
    }
    return this.prisma.employee.update({
      where: { id },
      data: {
        fullName: dto.fullName?.trim(),
        email: dto.email?.toLowerCase(),
        departmentId: dto.departmentId,
        grade: dto.grade,
        isActive: dto.isActive,
      },
      include: { department: true },
    });
  }

  async remove(organizationId: string, id: string) {
    const emp = await this.prisma.employee.findFirst({
      where: { id, organizationId },
    });
    if (!emp) {
      throw new NotFoundException('Сотрудник не найден');
    }
    await this.prisma.employee.delete({ where: { id } });
    return { ok: true };
  }

  async importCsv(organizationId: string, dto: ImportEmployeesDto) {
    const lines = dto.csv
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (!lines.length) {
      return { created: 0 };
    }

    const departments = await this.prisma.department.findMany({
      where: { organizationId },
    });
    const deptByName = new Map(
      departments.map((d) => [d.name.toLowerCase(), d.id]),
    );

    let created = 0;
    for (const line of lines) {
      if (line.toLowerCase().startsWith('fio') || line.toLowerCase().startsWith('фио')) {
        continue;
      }
      const parts = line.split(/[;,]/).map((p) => p.trim());
      const [fullName, email, deptName, grade] = parts;
      if (!fullName) continue;

      let departmentId: string | undefined;
      if (deptName) {
        const key = deptName.toLowerCase();
        departmentId = deptByName.get(key);
        if (!departmentId) {
          const dept = await this.prisma.department.create({
            data: { organizationId, name: deptName },
          });
          departmentId = dept.id;
          deptByName.set(key, dept.id);
        }
      }

      await this.prisma.employee.create({
        data: {
          organizationId,
          fullName,
          email: email || undefined,
          departmentId,
          grade: grade || undefined,
        },
      });
      created += 1;
    }

    return { created };
  }
}
