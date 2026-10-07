import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { IsString, MinLength } from 'class-validator';
import { OrgRole } from '@prisma/client';
import { Roles } from '../auth/decorators';
import { DepartmentsService } from './departments.service';

class NameDto {
  @IsString()
  @MinLength(1)
  name!: string;
}

@Controller('organizations/:organizationId/departments')
export class DepartmentsController {
  constructor(private readonly service: DepartmentsService) {}

  @Roles(OrgRole.VIEWER)
  @Get()
  list(@Param('organizationId') organizationId: string) {
    return this.service.list(organizationId);
  }

  @Roles(OrgRole.HR)
  @Post()
  create(
    @Param('organizationId') organizationId: string,
    @Body() dto: NameDto,
  ) {
    return this.service.create(organizationId, dto.name);
  }

  @Roles(OrgRole.HR)
  @Patch(':id')
  update(
    @Param('organizationId') organizationId: string,
    @Param('id') id: string,
    @Body() dto: NameDto,
  ) {
    return this.service.update(organizationId, id, dto.name);
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
