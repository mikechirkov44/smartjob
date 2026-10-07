import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { Public } from '../auth/decorators';
import { SubmitSurveyDto } from './public.dto';
import { PublicService } from './public.service';

@Public()
@Controller('public/surveys')
export class PublicController {
  constructor(private readonly service: PublicService) {}

  @Get(':token')
  get(@Param('token') token: string) {
    return this.service.getByToken(token);
  }

  @Post(':token/submit')
  submit(@Param('token') token: string, @Body() dto: SubmitSurveyDto) {
    return this.service.submit(token, dto);
  }
}
