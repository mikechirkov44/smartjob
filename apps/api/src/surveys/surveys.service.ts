import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  LinkType,
  QuestionType,
  SurveyStatus,
  SurveyTemplate,
} from '@prisma/client';
import { randomBytes } from 'crypto';
import * as QRCode from 'qrcode';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreatePersonalLinksDto,
  CreateSurveyDto,
  UpdateSurveyDto,
} from './surveys.dto';
import { ChoiceOption } from './choice.types';
import {
  ENPS_QUESTION,
  FULL_TEMPLATE,
  mapQuestionType,
  PULSE_TEMPLATE,
  TemplateQuestion,
  WORK_CONDITIONS_TEMPLATE,
} from './templates';

@Injectable()
export class SurveysService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private publicBaseUrl() {
    return this.config.get<string>('PUBLIC_WEB_URL', 'http://localhost:5173');
  }

  private makeToken() {
    return randomBytes(16).toString('hex');
  }

  private toQuestionType(type?: TemplateQuestion['type']): QuestionType {
    const mapped = mapQuestionType(type);
    if (mapped === 'ENPS') return QuestionType.ENPS;
    if (mapped === 'TEXT') return QuestionType.TEXT;
    if (mapped === 'GRID') return QuestionType.GRID;
    if (mapped === 'SINGLE') return QuestionType.SINGLE;
    return QuestionType.LIKERT;
  }

  private toScaleMax(q: TemplateQuestion): number {
    if (q.type === 'ENPS') return 10;
    if (q.type === 'TEXT' || q.type === 'GRID' || q.type === 'SINGLE') return 5;
    return q.scaleMax === 10 ? 10 : 5;
  }

  private normalizeChoices(
    q: NonNullable<CreateSurveyDto['questions']>[number],
  ): { choices: ChoiceOption[]; allowOther: boolean } {
    const choices = (q.choices || [])
      .map((choice) => ({ id: choice.id.trim(), label: choice.label.trim() }))
      .filter((choice) => choice.id && choice.label);
    if (choices.length < 2) {
      throw new BadRequestException(
        'В вопросе «один из списка» нужно минимум 2 варианта',
      );
    }
    if (choices.length > 30) {
      throw new BadRequestException('В вопросе не больше 30 вариантов');
    }
    const ids = new Set(choices.map((choice) => choice.id));
    if (ids.size !== choices.length) {
      throw new BadRequestException('Варианты ответа должны быть уникальными');
    }
    return { choices, allowOther: q.allowOther ?? false };
  }

  private normalizeGridQuestion(
    q: NonNullable<CreateSurveyDto['questions']>[number],
  ): Pick<TemplateQuestion, 'gridRows' | 'gridColumns' | 'requireAllRows'> {
    const rows = (q.gridRows || [])
      .map((r) => ({ id: r.id.trim(), label: r.label.trim() }))
      .filter((r) => r.id && r.label);
    const columns = (q.gridColumns || [])
      .map((c) => ({
        id: c.id.trim(),
        label: c.label.trim(),
        value: c.value == null ? null : Number(c.value),
      }))
      .filter((c) => c.id && c.label);

    if (rows.length < 1) {
      throw new BadRequestException('В сетке нужна хотя бы одна строка');
    }
    if (columns.length < 2) {
      throw new BadRequestException('В сетке нужно минимум 2 столбца');
    }
    return {
      gridRows: rows,
      gridColumns: columns,
      requireAllRows: q.requireAllRows ?? true,
    };
  }

  private resolveTemplateQuestions(
    template: SurveyTemplate,
    includeEnps: boolean,
    custom?: CreateSurveyDto['questions'],
  ): TemplateQuestion[] {
    if (template === SurveyTemplate.CUSTOM) {
      if (!custom?.length) {
        throw new BadRequestException(
          'Для своего опроса нужны вопросы',
        );
      }
      const questions: TemplateQuestion[] = custom.map((q) => {
        const type = mapQuestionType(q.type);
        if (type === 'GRID') {
          const grid = this.normalizeGridQuestion(q);
          return {
            text: q.text,
            metric: q.metric || 'Общее',
            category: q.category || 'custom',
            type,
            scaleMax: 5,
            ...grid,
          };
        }
        if (type === 'SINGLE') {
          const choice = this.normalizeChoices(q);
          return {
            text: q.text,
            metric: q.metric || 'Общее',
            category: q.category || 'custom',
            type,
            scaleMax: 5,
            ...choice,
          };
        }
        const scaleMax =
          type === 'ENPS' ? 10 : type === 'TEXT' ? 5 : q.scaleMax === 10 ? 10 : 5;
        return {
          text: q.text,
          metric: q.metric || 'Общее',
          category: q.category || 'custom',
          type,
          scaleMax,
          scaleMinLabel: q.scaleMinLabel?.trim() || undefined,
          scaleMaxLabel: q.scaleMaxLabel?.trim() || undefined,
        };
      });
      if (includeEnps && !questions.some((q) => q.type === 'ENPS')) {
        questions.push(ENPS_QUESTION);
      }
      return questions;
    }

    if (template === SurveyTemplate.WORK_CONDITIONS) {
      return [...WORK_CONDITIONS_TEMPLATE];
    }

    const base =
      template === SurveyTemplate.PULSE ? PULSE_TEMPLATE : FULL_TEMPLATE;
    const questions = [...base];
    if (includeEnps) {
      questions.push(ENPS_QUESTION);
    }
    return questions;
  }

  list(organizationId: string) {
    return this.prisma.survey.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { responses: true, links: true, questions: true } },
        links: {
          where: { type: LinkType.PUBLIC },
          take: 1,
        },
      },
    });
  }

  async getOne(organizationId: string, id: string) {
    const survey = await this.prisma.survey.findFirst({
      where: { id, organizationId },
      include: {
        questions: { orderBy: { sortOrder: 'asc' } },
        links: {
          include: {
            employee: { select: { id: true, fullName: true, email: true } },
            _count: { select: { responses: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        _count: { select: { responses: true } },
      },
    });
    if (!survey) {
      throw new NotFoundException('Опрос не найден');
    }
    return survey;
  }

  async create(organizationId: string, dto: CreateSurveyDto) {
    const includeEnps =
      dto.template === SurveyTemplate.WORK_CONDITIONS
        ? true
        : (dto.includeEnps ?? true);
    const questions = this.resolveTemplateQuestions(
      dto.template,
      includeEnps,
      dto.questions,
    );

    const survey = await this.prisma.$transaction(async (tx) => {
      const created = await tx.survey.create({
        data: {
          organizationId,
          title: dto.title.trim(),
          description: dto.description,
          coverImage: dto.coverImage || 'team-collab',
          template: dto.template,
          includeEnps,
          hideQuestionCategory: dto.hideQuestionCategory ?? false,
          adminCanIdentifyRespondents: dto.adminCanIdentifyRespondents ?? false,
          closesAt: dto.closesAt ? new Date(dto.closesAt) : null,
          status: SurveyStatus.DRAFT,
          questions: {
            create: questions.map((q, index) => ({
              sortOrder: index,
              text: q.text,
              metric: q.metric,
              category: q.category,
              type: this.toQuestionType(q.type),
              scaleMax: this.toScaleMax(q),
              scaleMinLabel: q.scaleMinLabel || null,
              scaleMaxLabel: q.scaleMaxLabel || null,
              gridRows: q.gridRows ?? undefined,
              gridColumns: q.gridColumns ?? undefined,
              requireAllRows: q.requireAllRows ?? true,
              choices: q.choices ?? undefined,
              allowOther: q.allowOther ?? false,
            })),
          },
        },
      });

      await tx.surveyLink.create({
        data: {
          surveyId: created.id,
          token: this.makeToken(),
          type: LinkType.PUBLIC,
        },
      });

      return created;
    });

    return this.getOne(organizationId, survey.id);
  }

  async update(organizationId: string, id: string, dto: UpdateSurveyDto) {
    const survey = await this.getOne(organizationId, id);

    if (dto.questions && survey.status !== SurveyStatus.DRAFT) {
      throw new BadRequestException(
        'Редактировать вопросы можно только в черновике',
      );
    }

    if (dto.status === SurveyStatus.ACTIVE) {
      if (survey.closesAt && survey.closesAt < new Date()) {
        throw new BadRequestException('Дата закрытия уже прошла');
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.survey.update({
        where: { id },
        data: {
          title: dto.title?.trim(),
          description: dto.description,
          coverImage: dto.coverImage,
          status: dto.status,
          includeEnps: dto.includeEnps,
          hideQuestionCategory: dto.hideQuestionCategory,
          adminCanIdentifyRespondents: dto.adminCanIdentifyRespondents,
          closesAt:
            dto.closesAt === null
              ? null
              : dto.closesAt
                ? new Date(dto.closesAt)
                : undefined,
        },
      });

      if (dto.questions) {
        await tx.answer.deleteMany({
          where: { question: { surveyId: id } },
        });
        await tx.response.deleteMany({ where: { surveyId: id } });
        await tx.surveyQuestion.deleteMany({ where: { surveyId: id } });
        const includeEnps = dto.includeEnps ?? survey.includeEnps;
        const questions = this.resolveTemplateQuestions(
          SurveyTemplate.CUSTOM,
          includeEnps,
          dto.questions,
        );
        await tx.surveyQuestion.createMany({
          data: questions.map((q, index) => ({
            surveyId: id,
            sortOrder: index,
            text: q.text,
            metric: q.metric,
            category: q.category,
            type: this.toQuestionType(q.type),
            scaleMax: this.toScaleMax(q),
            scaleMinLabel: q.scaleMinLabel || null,
            scaleMaxLabel: q.scaleMaxLabel || null,
            gridRows: q.gridRows ?? undefined,
            gridColumns: q.gridColumns ?? undefined,
            requireAllRows: q.requireAllRows ?? true,
            choices: q.choices ?? undefined,
            allowOther: q.allowOther ?? false,
          })),
        });
      }
    });

    return this.getOne(organizationId, id);
  }

  async remove(organizationId: string, id: string) {
    await this.getOne(organizationId, id);
    await this.prisma.survey.delete({ where: { id } });
    return { ok: true };
  }

  async ensurePublicLink(organizationId: string, surveyId: string) {
    await this.getOne(organizationId, surveyId);
    let link = await this.prisma.surveyLink.findFirst({
      where: { surveyId, type: LinkType.PUBLIC },
    });
    if (!link) {
      link = await this.prisma.surveyLink.create({
        data: {
          surveyId,
          token: this.makeToken(),
          type: LinkType.PUBLIC,
        },
      });
    }
    return this.formatLink(link.token);
  }

  async createPersonalLinks(
    organizationId: string,
    surveyId: string,
    dto: CreatePersonalLinksDto,
  ) {
    await this.getOne(organizationId, surveyId);
    const employees = await this.prisma.employee.findMany({
      where: {
        organizationId,
        id: { in: dto.employeeIds },
        isActive: true,
      },
    });

    const results = [];
    for (const emp of employees) {
      const existing = await this.prisma.surveyLink.findFirst({
        where: {
          surveyId,
          employeeId: emp.id,
          type: LinkType.PERSONAL,
        },
      });
      const link =
        existing ||
        (await this.prisma.surveyLink.create({
          data: {
            surveyId,
            employeeId: emp.id,
            token: this.makeToken(),
            type: LinkType.PERSONAL,
          },
        }));
      results.push({
        employeeId: emp.id,
        fullName: emp.fullName,
        ...this.formatLink(link.token),
      });
    }
    return results;
  }

  async qrCode(organizationId: string, surveyId: string, token?: string) {
    const survey = await this.getOne(organizationId, surveyId);
    let linkToken = token;
    if (!linkToken) {
      const publicLink = survey.links.find((l) => l.type === LinkType.PUBLIC);
      if (!publicLink) {
        throw new NotFoundException('Публичная ссылка не найдена');
      }
      linkToken = publicLink.token;
    }
    const url = `${this.publicBaseUrl()}/s/${linkToken}`;
    const dataUrl = await QRCode.toDataURL(url, {
      width: 512,
      margin: 2,
      errorCorrectionLevel: 'M',
    });
    return { url, qrDataUrl: dataUrl };
  }

  private formatLink(token: string) {
    const url = `${this.publicBaseUrl()}/s/${token}`;
    return { token, url };
  }

  async listResponses(organizationId: string, surveyId: string) {
    const survey = await this.getOne(organizationId, surveyId);
    const responses = await this.prisma.response.findMany({
      where: { surveyId },
      orderBy: { completedAt: 'desc' },
      include: {
        answers: true,
        employee: {
          select: { id: true, fullName: true, email: true },
        },
        link: { select: { type: true } },
      },
    });

    return responses.map((r) => {
      const canIdentify =
        survey.adminCanIdentifyRespondents && r.link.type === LinkType.PERSONAL;
      return {
        id: r.id,
        completedAt: r.completedAt,
        departmentName: r.departmentName,
        grade: r.grade,
        enps: r.enps,
        answersCount: r.answers.length,
        employee: canIdentify
          ? r.employee
          : null,
        anonymous: !canIdentify,
      };
    });
  }

  async removeResponse(
    organizationId: string,
    surveyId: string,
    responseId: string,
  ) {
    await this.getOne(organizationId, surveyId);
    const response = await this.prisma.response.findFirst({
      where: { id: responseId, surveyId },
    });
    if (!response) {
      throw new NotFoundException('Ответ не найден');
    }
    await this.prisma.response.delete({ where: { id: responseId } });
    return { ok: true };
  }

  async clearResponses(organizationId: string, surveyId: string) {
    await this.getOne(organizationId, surveyId);
    const result = await this.prisma.response.deleteMany({
      where: { surveyId },
    });
    return { ok: true, deleted: result.count };
  }
}
