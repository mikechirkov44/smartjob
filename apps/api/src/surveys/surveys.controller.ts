import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { OrgRole } from '@prisma/client';
import { Roles } from '../auth/decorators';
import {
  CreatePersonalLinksDto,
  CreateSurveyDto,
  UpdateSurveyDto,
} from './surveys.dto';
import { SurveysService } from './surveys.service';

@Controller('organizations/:organizationId/surveys')
export class SurveysController {
  constructor(private readonly service: SurveysService) {}

  @Roles(OrgRole.VIEWER)
  @Get()
  list(@Param('organizationId') organizationId: string) {
    return this.service.list(organizationId);
  }

  @Roles(OrgRole.VIEWER)
  @Get(':id')
  getOne(
    @Param('organizationId') organizationId: string,
    @Param('id') id: string,
  ) {
    return this.service.getOne(organizationId, id);
  }

  @Roles(OrgRole.HR)
  @Post()
  create(
    @Param('organizationId') organizationId: string,
    @Body() dto: CreateSurveyDto,
  ) {
    return this.service.create(organizationId, dto);
  }

  @Roles(OrgRole.HR)
  @Patch(':id')
  update(
    @Param('organizationId') organizationId: string,
    @Param('id') id: string,
    @Body() dto: UpdateSurveyDto,
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

  @Roles(OrgRole.HR)
  @Post(':id/public-link')
  publicLink(
    @Param('organizationId') organizationId: string,
    @Param('id') id: string,
  ) {
    return this.service.ensurePublicLink(organizationId, id);
  }

  @Roles(OrgRole.HR)
  @Post(':id/personal-links')
  personalLinks(
    @Param('organizationId') organizationId: string,
    @Param('id') id: string,
    @Body() dto: CreatePersonalLinksDto,
  ) {
    return this.service.createPersonalLinks(organizationId, id, dto);
  }

  @Roles(OrgRole.HR)
  @Get(':id/qr')
  qr(
    @Param('organizationId') organizationId: string,
    @Param('id') id: string,
    @Query('token') token?: string,
  ) {
    return this.service.qrCode(organizationId, id, token);
  }

  @Roles(OrgRole.VIEWER)
  @Get(':id/responses')
  responses(
    @Param('organizationId') organizationId: string,
    @Param('id') id: string,
  ) {
    return this.service.listResponses(organizationId, id);
  }
}
