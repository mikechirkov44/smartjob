import { Controller, Get, Param, Query } from '@nestjs/common';
import { OrgRole } from '@prisma/client';
import { Roles } from '../auth/decorators';
import { AnalyticsService } from './analytics.service';

@Controller('organizations/:organizationId/analytics')
export class AnalyticsController {
  constructor(private readonly service: AnalyticsService) {}

  @Roles(OrgRole.VIEWER)
  @Get()
  overview(
    @Param('organizationId') organizationId: string,
    @Query('surveyId') surveyId?: string,
  ) {
    return this.service.overview(organizationId, surveyId);
  }
}
