import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { QuestionType, SurveyStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SubmitSurveyDto } from './public.dto';

@Injectable()
export class PublicService {
  constructor(private readonly prisma: PrismaService) {}

  private assertSurveyOpen(survey: {
    status: SurveyStatus;
    closesAt: Date | null;
  }) {
    if (survey.status === SurveyStatus.DRAFT) {
      throw new BadRequestException(
        'Опрос ещё не открыт. В админке нажмите «Открыть».',
      );
    }
    if (survey.status === SurveyStatus.CLOSED) {
      throw new BadRequestException('Опрос закрыт администратором');
    }
    if (survey.status !== SurveyStatus.ACTIVE) {
      throw new BadRequestException('Опрос сейчас недоступен');
    }
    if (survey.closesAt && survey.closesAt < new Date()) {
      throw new BadRequestException('Срок прохождения опроса истёк');
    }
  }

  async getByToken(token: string) {
    const link = await this.prisma.surveyLink.findUnique({
      where: { token },
      include: {
        survey: {
          include: {
            questions: { orderBy: { sortOrder: 'asc' } },
            organization: { select: { name: true } },
          },
        },
        employee: {
          select: { id: true, departmentId: true, grade: true },
        },
      },
    });

    if (!link || !link.isActive) {
      throw new NotFoundException('Ссылка недействительна');
    }

    const survey = link.survey;
    this.assertSurveyOpen(survey);

    return {
      token: link.token,
      organizationName: survey.organization.name,
      survey: {
        id: survey.id,
        title: survey.title,
        description: survey.description,
        coverImage: survey.coverImage,
        template: survey.template,
        includeEnps: survey.includeEnps,
        questions: survey.questions.map((q) => ({
          id: q.id,
          text: q.text,
          metric: q.metric,
          category: q.category,
          type: q.type,
          scaleMax: q.scaleMax,
          sortOrder: q.sortOrder,
        })),
      },
      anonymousNotice:
        'Опрос анонимный для участников. Ваши ответы не будут показаны коллегам.',
    };
  }

  async submit(token: string, dto: SubmitSurveyDto) {
    const link = await this.prisma.surveyLink.findUnique({
      where: { token },
      include: {
        survey: { include: { questions: true } },
        employee: { include: { department: true } },
        responses: { select: { id: true }, take: 1 },
      },
    });

    if (!link || !link.isActive) {
      throw new NotFoundException('Ссылка недействительна');
    }

    const survey = link.survey;
    this.assertSurveyOpen(survey);

    if (link.type === 'PERSONAL' && link.responses.length > 0) {
      throw new BadRequestException('Вы уже прошли этот опрос');
    }

    const questionMap = new Map(survey.questions.map((q) => [q.id, q]));
    const answeredIds = new Set(dto.answers.map((a) => a.questionId));
    for (const question of survey.questions) {
      if (!answeredIds.has(question.id)) {
        throw new BadRequestException('Ответьте на все вопросы');
      }
    }

    for (const answer of dto.answers) {
      const question = questionMap.get(answer.questionId);
      if (!question) {
        throw new BadRequestException('Некорректный вопрос в ответе');
      }
      if (question.type === QuestionType.TEXT) {
        if (!answer.valueText?.trim()) {
          throw new BadRequestException('Текстовый ответ не может быть пустым');
        }
        continue;
      }
      if (question.type === QuestionType.LIKERT) {
        const max = question.scaleMax === 10 ? 10 : 5;
        if (
          answer.valueInt == null ||
          answer.valueInt < 1 ||
          answer.valueInt > max
        ) {
          throw new BadRequestException(`Оценка должна быть от 1 до ${max}`);
        }
      }
      if (question.type === QuestionType.ENPS) {
        if (
          answer.valueInt == null ||
          answer.valueInt < 0 ||
          answer.valueInt > 10
        ) {
          throw new BadRequestException('eNPS должен быть от 0 до 10');
        }
      }
    }

    const enpsAnswer = dto.answers.find((a) => {
      const q = questionMap.get(a.questionId);
      return q?.type === QuestionType.ENPS;
    });
    const enps = dto.enps ?? enpsAnswer?.valueInt ?? null;

    const response = await this.prisma.response.create({
      data: {
        surveyId: survey.id,
        linkId: link.id,
        employeeId: link.employeeId,
        departmentName: link.employee?.department?.name,
        grade: link.employee?.grade,
        enps: enps ?? undefined,
        answers: {
          create: dto.answers.map((a) => ({
            questionId: a.questionId,
            valueInt: a.valueInt,
            valueText: a.valueText,
          })),
        },
      },
      include: { answers: true },
    });

    return {
      ok: true,
      responseId: response.id,
      message: 'Спасибо! Ваши ответы сохранены.',
    };
  }
}
