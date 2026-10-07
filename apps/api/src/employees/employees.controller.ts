import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { OrgRole } from '@prisma/client';
import { Roles } from '../auth/decorators';
import {
  CreateEmployeeDto,
  ImportEmployeesDto,
  UpdateEmployeeDto,
} from './employees.dto';
import { EmployeesService } from './employees.service';

@Controller('organizations/:organizationId/employees')
export class EmployeesController {
  constructor(private readonly service: EmployeesService) {}

  @Roles(OrgRole.VIEWER)
  @Get()
  list(@Param('organizationId') organizationId: string) {
    return this.service.list(organizationId);
  }

  @Roles(OrgRole.HR)
  @Post()
  create(
    @Param('organizationId') organizationId: string,
    @Body() dto: CreateEmployeeDto,
  ) {
    return this.service.create(organizationId, dto);
  }

  @Roles(OrgRole.HR)
  @Post('import')
  importCsv(
    @Param('organizationId') organizationId: string,
    @Body() dto: ImportEmployeesDto,
  ) {
    return this.service.importCsv(organizationId, dto);
  }

  @Roles(OrgRole.HR)
  @Patch(':id')
  update(
    @Param('organizationId') organizationId: string,
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeDto,
  ) {
    return this.service.update(organizationId, id, dto);
  }

  @Roles(OrgRole.HR)
  @Delete(':id')
  remove(
    @Param('organizationId') organizationId: string,
    @Param('id') id: string,
  ) {
    return this.service.remove(organizationId, id);
  }
}
