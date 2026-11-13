import { stat } from 'fs/promises';
import { join } from 'path';
import {
  Injectable,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import type { RequestUser } from '../auth/auth.types';
import {
  validateContent,
  publicContent,
  scoreAnswers,
} from './training.content';
import type { TrainingContent } from './training.content';
import { phishingTemplate } from './phishing-template';
const token = () => randomBytes(24).toString('hex');
const json = (v: unknown) => v as Prisma.InputJsonValue;
@Injectable()
export class TrainingService {
  constructor(private readonly db: PrismaService) {}
  async access(user: RequestUser, org: string, write = false) {
    const rank = { VIEWER: 1, HR: 2, ADMIN: 3, OWNER: 4 };
    if (user.globalRole !== 'SUPER_ADMIN') {
      const m = user.memberships.find((m) => m.organizationId === org);
      if (!m || rank[m.role] < (write ? 2 : 1))
        throw new ForbiddenException('Нет доступа к организации');
    }
    const o = await this.db.organization.findUnique({ where: { id: org } });
    if (!o?.isActive) throw new ForbiddenException('Организация недоступна');
  }
  async list(org: string) {
    return this.db.trainingCourse.findMany({
      where: { organizationId: org },
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        status: true,
        token: true,
        publishedVersion: true,
        updatedAt: true,
      },
    });
  }
  async get(org: string, id: string) {
    const c = await this.db.trainingCourse.findFirst({
      where: { id, organizationId: org },
    });
    if (!c) throw new NotFoundException('Курс не найден');
    return c;
  }
  async create(org: string, template?: string) {
    const content =
      template === 'blank'
        ? {
            ...phishingTemplate(),
            title: 'Новый курс',
            description: '',
            questions: [],
            blocks: [],
            reminder: '',
          }
        : phishingTemplate();
    return this.db.trainingCourse.create({
      data: {
        organizationId: org,
        title: content.title,
        draft: json(content),
        token: token(),
      },
    });
  }
  async ownedMedia(
    org: string,
    content: TrainingContent,
    db: Prisma.TransactionClient | PrismaService = this.db,
  ) {
    const blocks = content.blocks.filter((b) => b.url);
    if (!blocks.length) return;
    const names = [...new Set(blocks.map((b) => b.url!.split('/').pop()!))];
    const rows = await db.trainingMedia.findMany({
      where: { organizationId: org, filename: { in: names } },
    });
    for (const b of blocks) {
      const filename = b.url!.split('/').pop()!;
      const m = rows.find((m) => m.filename === filename);
      const file = await stat(
        join(
          process.env.UPLOAD_DIR || join(process.cwd(), 'uploads'),
          'training',
          filename,
        ),
      ).catch(() => null);
      if (
        !m ||
        !file?.isFile() ||
        file.size !== m.size ||
        !(b.type === 'image'
          ? m.mime.startsWith('image/')
          : m.mime.startsWith('video/'))
      )
        throw new BadRequestException(
          'Материал отсутствует или принадлежит другой организации',
        );
    }
  }
  async save(org: string, id: string, value: unknown) {
    await this.get(org, id);
    const content = validateContent(value, false);
    await this.ownedMedia(org, content);
    return this.db.trainingCourse.update({
      where: { id },
      data: { title: content.title, draft: json(content) },
    });
  }
  async publish(org: string, id: string, draftVersion: string) {
    return this.db.$transaction(async (tx) => {
      const course = await tx.trainingCourse.findFirst({
        where: { id, organizationId: org },
      });
      if (!course) throw new NotFoundException();
      if (course.updatedAt.toISOString() !== draftVersion)
        throw new ConflictException(
          'Курс изменён другим редактором. Обновите страницу перед публикацией.',
        );
      const content = validateContent(course.draft);
      await this.ownedMedia(org, content, tx);
      const updated = await tx.trainingCourse.update({
        where: { id },
        data: { publishedVersion: { increment: 1 }, status: 'ACTIVE' },
      });
      await tx.trainingRevision.create({
        data: {
          courseId: id,
          version: updated.publishedVersion,
          content: json(content),
        },
      });
      return updated;
    });
  }
  async close(org: string, id: string) {
    await this.get(org, id);
    return this.db.trainingCourse.update({
      where: { id },
      data: { status: 'CLOSED' },
    });
  }
  async duplicate(org: string, id: string) {
    const c = await this.get(org, id);
    const content = validateContent(c.draft, false);
    content.title = content.title.slice(0, 185) + ' (копия)';
    return this.db.trainingCourse.create({
      data: {
        organizationId: org,
        title: content.title,
        draft: json(content),
        token: token(),
      },
    });
  }
  async active(link: string) {
    const course = await this.db.trainingCourse.findUnique({
      where: { token: link },
    });
    if (!course || course.status !== 'ACTIVE')
      throw new NotFoundException('Курс закрыт или не опубликован');
    const o = await this.db.organization.findUnique({
      where: { id: course.organizationId },
    });
    if (!o?.isActive) throw new NotFoundException('Курс недоступен');
    return course;
  }
  async overview(link: string) {
    const c = await this.active(link);
    const r = await this.db.trainingRevision.findUnique({
      where: {
        courseId_version: { courseId: c.id, version: c.publishedVersion },
      },
    });
    if (!r) throw new NotFoundException();
    const content = r.content as unknown as TrainingContent;
    return {
      title: content.title,
      description: content.description,
      questionCount: content.questions.length,
      version: r.version,
    };
  }
  async start(link: string, name: string) {
    const participantName = name.trim().replace(/\s+/g, ' ');
    if (participantName.length < 3 || participantName.length > 160)
      throw new BadRequestException(
        'Введите имя и фамилию (от 3 до 160 символов)',
      );
    const c = await this.active(link);
    const r = await this.db.trainingRevision.findUnique({
      where: {
        courseId_version: { courseId: c.id, version: c.publishedVersion },
      },
    });
    if (!r) throw new NotFoundException();
    return this.db.trainingAttempt.create({
      data: { revisionId: r.id, participantName, token: token() },
      select: { token: true },
    });
  }
  async loadAttempt(
    t: string,
    db: Prisma.TransactionClient | PrismaService = this.db,
  ) {
    const a = await db.trainingAttempt.findUnique({
      where: { token: t },
      include: {
        answers: { orderBy: { createdAt: 'asc' } },
        revision: { include: { course: true } },
      },
    });
    if (!a) throw new NotFoundException('Попытка не найдена');
    if (a.revision.course.status !== 'ACTIVE')
      throw new NotFoundException('Курс закрыт');
    const org = await db.organization.findUnique({
      where: { id: a.revision.course.organizationId },
    });
    if (!org?.isActive) throw new NotFoundException('Курс недоступен');
    return a;
  }
  async attempt(t: string) {
    const a = await this.loadAttempt(t);
    const c = a.revision.content as unknown as TrainingContent;
    return {
      token: a.token,
      participantName: a.participantName,
      version: a.revision.version,
      content: publicContent(c),
      answers: a.answers.map((v) => this.feedback(c, v.questionId, v.choice)),
      completedAt: a.completedAt,
      result: a.completedAt ? scoreAnswers(c, a.answers) : null,
    };
  }
  feedback(c: TrainingContent, id: string, choice: boolean) {
    const q = c.questions.find((q) => q.id === id);
    if (!q) throw new BadRequestException('Задание не найдено');
    return {
      questionId: id,
      choice,
      correct: choice === q.phishing,
      phishing: q.phishing,
      explanation: q.explanation,
    };
  }
  async serial<T>(
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    for (let i = 0; ; i++) {
      try {
        return await this.db.$transaction(fn, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
        });
      } catch (e) {
        if (
          e instanceof Prisma.PrismaClientKnownRequestError &&
          ['P2034', 'P2002'].includes(e.code) &&
          i < 3
        )
          continue;
        throw e;
      }
    }
  }
  async answer(t: string, id: string, choice: boolean) {
    return this.serial(async (tx) => {
      const a = await this.loadAttempt(t, tx);
      const c = a.revision.content as unknown as TrainingContent;
      const existing = a.answers.find((v) => v.questionId === id);
      if (existing) return this.feedback(c, id, existing.choice);
      if (a.completedAt) throw new ConflictException('Попытка завершена');
      const next = c.questions[a.answers.length];
      if (!next || next.id !== id)
        throw new BadRequestException('Отвечайте на задания по порядку');
      const feedback = this.feedback(c, id, choice);
      await tx.trainingAnswer.create({
        data: {
          attemptId: a.id,
          questionId: id,
          choice,
          correct: feedback.correct,
        },
      });
      return feedback;
    });
  }
  async complete(t: string) {
    return this.serial(async (tx) => {
      const a = await this.loadAttempt(t, tx);
      const result = scoreAnswers(
        a.revision.content as unknown as TrainingContent,
        a.answers,
      );
      if (!a.completedAt)
        await tx.trainingAttempt.update({
          where: { id: a.id },
          data: {
            completedAt: new Date(),
            score: result.score,
            passed: result.passed,
          },
        });
      return result;
    });
  }
  async results(org: string, id: string, page = 1) {
    await this.get(org, id);
    const where = { revision: { courseId: id } };
    const [items, total] = await this.db.$transaction([
      this.db.trainingAttempt.findMany({
        where,
        skip: (page - 1) * 20,
        take: 20,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          participantName: true,
          createdAt: true,
          completedAt: true,
          score: true,
          passed: true,
          revision: { select: { version: true, content: true } },
          answers: { orderBy: { createdAt: 'asc' } },
        },
      }),
      this.db.trainingAttempt.count({ where }),
    ]);
    return { items, total, page };
  }
}
