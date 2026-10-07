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
import { Roles, SuperAdminOnly } from '../auth/decorators';
import {
  AddMemberDto,
  CreateOrganizationDto,
  UpdateMemberRoleDto,
  UpdateOrganizationDto,
} from './organizations.dto';
import { OrganizationsService } from './organizations.service';

@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly service: OrganizationsService) {}

  @SuperAdminOnly()
  @Get()
  list() {
    return this.service.listAll();
  }

  @SuperAdminOnly()
  @Post()
  create(@Body() dto: CreateOrganizationDto) {
    return this.service.create(dto);
  }

  @Roles(OrgRole.VIEWER)
  @Get(':organizationId')
  getOne(@Param('organizationId') organizationId: string) {
    return this.service.getOne(organizationId);
  }

  @Roles(OrgRole.ADMIN)
  @Patch(':organizationId')
  update(
    @Param('organizationId') organizationId: string,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return this.service.update(organizationId, dto);
  }

  @Roles(OrgRole.ADMIN)
  @Post(':organizationId/members')
  addMember(
    @Param('organizationId') organizationId: string,
    @Body() dto: AddMemberDto,
  ) {
    return this.service.addMember(organizationId, dto);
  }

  @Roles(OrgRole.ADMIN)
  @Patch(':organizationId/members/:memberId')
  updateMember(
    @Param('organizationId') organizationId: string,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.service.updateMemberRole(organizationId, memberId, dto);
  }

  @Roles(OrgRole.ADMIN)
  @Delete(':organizationId/members/:memberId')
  removeMember(
    @Param('organizationId') organizationId: string,
    @Param('memberId') memberId: string,
  ) {
    return this.service.removeMember(organizationId, memberId);
  }
}
