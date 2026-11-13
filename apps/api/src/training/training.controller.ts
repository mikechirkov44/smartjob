import {
  Body,
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Req,
  UseGuards,
  Injectable,
  CanActivate,
  ExecutionContext,
} from '@nestjs/common';
import { TrainingService } from './training.service';
import {
  PublishTrainingDto,
  CreateCourseDto,
  SaveCourseDto,
  StartTrainingDto,
  TrainingAnswerDto,
} from './training.dto';
import { Public } from '../auth/decorators';
import type { RequestUser } from '../auth/auth.types';
type AuthRequest = {
  user: RequestUser;
  params: { organizationId: string; id?: string };
  route?: { path?: string };
  method: string;
};
@Injectable()
export class TrainingAccessGuard implements CanActivate {
  constructor(private readonly service: TrainingService) {}
  async canActivate(ctx: ExecutionContext) {
    const r = ctx.switchToHttp().getRequest<AuthRequest>();
    await this.service.access(
      r.user,
      r.params.organizationId,
      r.method !== 'GET' ||
        (!!r.params.id && !r.route?.path?.endsWith('/attempts')),
    );
    return true;
  }
}
@Controller('organizations/:organizationId/training')
@UseGuards(TrainingAccessGuard)
export class TrainingController {
  constructor(private readonly service: TrainingService) {}
  @Get() list(@Param('organizationId') org: string) {
    return this.service.list(org);
  }
  @Post() create(
    @Param('organizationId') org: string,
    @Body() dto: CreateCourseDto,
  ) {
    return this.service.create(org, dto.template);
  }
  @Get(':id') get(
    @Param('organizationId') org: string,
    @Param('id') id: string,
  ) {
    return this.service.get(org, id);
  }
  @Patch(':id') save(
    @Param('organizationId') org: string,
    @Param('id') id: string,
    @Body() dto: SaveCourseDto,
  ) {
    return this.service.save(org, id, dto.content);
  }
  @Post(':id/publish') publish(
    @Param('organizationId') org: string,
    @Param('id') id: string,
    @Body() dto: PublishTrainingDto,
  ) {
    return this.service.publish(org, id, dto.draftVersion);
  }
  @Post(':id/close') close(
    @Param('organizationId') org: string,
    @Param('id') id: string,
  ) {
    return this.service.close(org, id);
  }
  @Post(':id/duplicate') duplicate(
    @Param('organizationId') org: string,
    @Param('id') id: string,
  ) {
    return this.service.duplicate(org, id);
  }
  @Get(':id/attempts') results(
    @Param('organizationId') org: string,
    @Param('id') id: string,
    @Query('page') page?: string,
  ) {
    return this.service.results(
      org,
      id,
      Math.min(100000, Math.max(1, Number.parseInt(page || '1', 10) || 1)),
    );
  }
}
@Public()
@Controller('public/training')
export class PublicTrainingController {
  constructor(private readonly service: TrainingService) {}
  @Get('attempts/:token') attempt(@Param('token') t: string) {
    return this.service.attempt(t);
  }
  @Post('attempts/:token/answers') answer(
    @Param('token') t: string,
    @Body() dto: TrainingAnswerDto,
  ) {
    return this.service.answer(t, dto.questionId, dto.choice);
  }
  @Post('attempts/:token/complete') complete(@Param('token') t: string) {
    return this.service.complete(t);
  }
  @Get(':token') overview(@Param('token') t: string) {
    return this.service.overview(t);
  }
  @Post(':token/start') start(
    @Param('token') t: string,
    @Body() dto: StartTrainingDto,
  ) {
    return this.service.start(t, dto.participantName);
  }
}
