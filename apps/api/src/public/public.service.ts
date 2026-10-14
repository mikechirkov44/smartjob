import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { LinkType, QuestionType, SurveyStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  isChoiceOptions,
  OTHER_CHOICE_ID,
  parseChoiceAnswer,
} from '../surveys/choice.types';
import {
  isGridColumns,
  isGridRows,
  parseGridAnswer,
} from '../surveys/grid.types';
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

  /** Successful completion = at least one answer. Empty shells are cleaned up. */
  private async personalLinkCompleted(linkId: string): Promise<boolean> {
    await this.prisma.response.deleteMany({
      where: {
        linkId,
        answers: { none: {} },
      },
    });
    const completed = await this.prisma.response.findFirst({
      where: {
        linkId,
        answers: { some: {} },
      },
      select: { id: true },
    });
    return Boolean(completed);
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

    const alreadyCompleted =
      link.type === LinkType.PERSONAL
        ? await this.personalLinkCompleted(link.id)
        : false;

    return {
      token: link.token,
      alreadyCompleted,
      organizationName: survey.organization.name,
      survey: {
        id: survey.id,
        title: survey.title,
        description: survey.description,
        coverImage: survey.coverImage,
        template: survey.template,
        includeEnps: survey.includeEnps,
        hideQuestionCategory: survey.hideQuestionCategory,
        questions: alreadyCompleted
          ? []
          : survey.questions.map((q) => ({
              id: q.id,
              text: q.text,
              metric: q.metric,
              category: q.category,
              type: q.type,
              scaleMax: q.scaleMax,
              scaleMinLabel: q.scaleMinLabel,
              scaleMaxLabel: q.scaleMaxLabel,
              gridRows: q.gridRows,
              gridColumns: q.gridColumns,
              requireAllRows: q.requireAllRows,
              choices: q.choices,
              allowOther: q.allowOther,
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
      },
    });

    if (!link || !link.isActive) {
      throw new NotFoundException('Ссылка недействительна');
    }

    const survey = link.survey;
    this.assertSurveyOpen(survey);

    if (
      link.type === LinkType.PERSONAL &&
      (await this.personalLinkCompleted(link.id))
    ) {
      throw new BadRequestException(
        'Вы уже прошли этот опрос. Повторное прохождение возможно только после удаления результата администратором.',
      );
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
      if (question.type === QuestionType.SINGLE) {
        if (!isChoiceOptions(question.choices) || question.choices.length < 2) {
          throw new BadRequestException('Варианты ответа настроены некорректно');
        }
        const picked = parseChoiceAnswer(answer.valueJson);
        if (!picked) {
          throw new BadRequestException('Выберите один вариант');
        }
        if (picked.choiceId === OTHER_CHOICE_ID) {
          if (!question.allowOther || !picked.otherText) {
            throw new BadRequestException('Укажите свой вариант');
          }
          continue;
        }
        if (!question.choices.some((choice) => choice.id === picked.choiceId)) {
          throw new BadRequestException('Некорректный вариант ответа');
        }
        continue;
      }
      if (question.type === QuestionType.GRID) {
        if (!isGridRows(question.gridRows) || !isGridColumns(question.gridColumns)) {
          throw new BadRequestException('Сетка настроена некорректно');
        }
        const gridAnswer = parseGridAnswer(answer.valueJson);
        if (!gridAnswer) {
          throw new BadRequestException('Ответ по сетке обязателен');
        }
        const colIds = new Set(question.gridColumns.map((c) => c.id));
        for (const row of question.gridRows) {
          const picked = gridAnswer[row.id];
          if (!picked) {
            if (question.requireAllRows) {
              throw new BadRequestException(
                'Отметьте ответ в каждой строке сетки',
              );
            }
            continue;
          }
          if (!colIds.has(picked)) {
            throw new BadRequestException('Некорректный столбец в ответе сетки');
          }
        }
        if (
          !question.requireAllRows &&
          Object.keys(gridAnswer).length === 0
        ) {
          throw new BadRequestException('Отметьте хотя бы одну строку сетки');
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
          create: dto.answers.map((a) => {
            const question = questionMap.get(a.questionId);
            if (question?.type === QuestionType.SINGLE && isChoiceOptions(question.choices)) {
              const picked = parseChoiceAnswer(a.valueJson);
              const label =
                picked?.choiceId === OTHER_CHOICE_ID
                  ? picked.otherText || ''
                  : question.choices.find((choice) => choice.id === picked?.choiceId)
                      ?.label || '';
              return {
                questionId: a.questionId,
                valueText: label,
                valueJson: picked
                  ? {
                      choiceId: picked.choiceId,
                      ...(picked.otherText ? { otherText: picked.otherText } : {}),
                    }
                  : undefined,
              };
            }
            return {
              questionId: a.questionId,
              valueInt: a.valueInt,
              valueText: a.valueText,
              valueJson: a.valueJson ?? undefined,
            };
          }),
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
