import { Injectable, NotFoundException } from '@nestjs/common';
import { LinkType, Prisma, SurveyTemplate } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  isGridColumns,
  isGridRows,
  parseGridAnswer,
} from '../surveys/grid.types';
import {
  cronbachAlpha,
  mean,
  multipleRegression,
  pearson,
  pearsonPValue,
  round2,
  weekKey,
} from './stats';

/** Classic Full engagement metrics — preserved for FULL template. */
const ENG_METRICS = [
  'Руководитель',
  'Стратегия',
  'Признание',
  'Обратная связь',
  'Процессы',
  'Изменения',
  'Коллеги',
  'Баланс',
  'Карьера',
  'Условия и оплата',
];

const LOY_METRICS = [
  'Гордится компанией',
  'Рекомендует компанию',
  'Остается сейчас',
  'Остается в будущем',
];

const SAT_METRICS = [
  'Интерес',
  'Условия труда',
  'Льготы',
  'Оплата',
  'Безопасность',
];

const SKIP_DRIVER_METRICS = new Set(
  ['фио', 'enps', 'e-nps', 'общее'].map((s) => s.toLowerCase()),
);

const SKIP_DRIVER_CATEGORIES = new Set(['profile', 'open']);

const BENCHMARK = {
  Вовлечённость: 3.75,
  Лояльность: 3.68,
  Удовлетворённость: 3.82,
  eNPS: 7.5,
};

type AnalyticRow = {
  id: string;
  date: string;
  dept: string;
  grade: string;
  enps: number;
  engagementIndex: number;
  loyaltyIndex: number;
  satisfactionIndex: number;
  metrics: Record<string, number>;
};

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async overview(organizationId: string, surveyId?: string) {
    const surveyList = await this.prisma.survey.findMany({
      where: { organizationId },
      select: { id: true, title: true, status: true },
      orderBy: { createdAt: 'desc' },
    });

    const surveys = await this.prisma.survey.findMany({
      where: {
        organizationId,
        ...(surveyId ? { id: surveyId } : {}),
      },
      include: {
        questions: { orderBy: { sortOrder: 'asc' } },
        responses: {
          include: {
            answers: true,
            employee: {
              select: { id: true, fullName: true, email: true },
            },
            link: { select: { type: true } },
          },
        },
      },
    });

    if (surveyId && !surveys.length) {
      throw new NotFoundException('Опрос не найден');
    }

    const rows = this.buildRows(surveys);
    const driverMetrics = this.resolveDriverMetrics(surveys);
    const analytics = this.compute(rows, driverMetrics);

    return {
      ...analytics,
      responses: this.buildRecentResponses(surveys, rows),
      surveys: surveyList.map((s) => ({
        id: s.id,
        title: s.title,
        status: s.status,
      })),
      engMetrics: driverMetrics,
      benchmarks: BENCHMARK,
    };
  }

  private isSkippedDriverMetric(metric: string) {
    return SKIP_DRIVER_METRICS.has(metric.trim().toLowerCase());
  }

  private collectScaleMetrics(
    questions: Array<{
      metric: string | null;
      category: string | null;
      type: string;
      gridRows?: Prisma.JsonValue | null;
    }>,
  ): string[] {
    const names = new Set<string>();
    for (const q of questions) {
      const cat = (q.category || '').toLowerCase();
      if (SKIP_DRIVER_CATEGORIES.has(cat)) continue;
      if (q.type === 'ENPS' || q.type === 'TEXT') continue;

      if (q.type === 'GRID' && isGridRows(q.gridRows)) {
        for (const row of q.gridRows) {
          const label = (row.label || q.metric || '').trim();
          if (label && !this.isSkippedDriverMetric(label)) names.add(label);
        }
        continue;
      }

      const metric = (q.metric || '').trim();
      if (metric && !this.isSkippedDriverMetric(metric)) names.add(metric);
    }
    return [...names];
  }

  private orderDriverMetrics(metrics: string[]): string[] {
    const set = new Set(metrics);
    const preferred = [...ENG_METRICS, ...LOY_METRICS, ...SAT_METRICS].filter(
      (m) => set.has(m),
    );
    const rest = metrics
      .filter((m) => !preferred.includes(m))
      .sort((a, b) => a.localeCompare(b, 'ru'));
    return [...preferred, ...rest];
  }

  /**
   * Single FULL → classic 10 engagement metrics.
   * Single PULSE / CUSTOM / WORK_CONDITIONS → metrics from that survey.
   * Several surveys / «all» → classic Full set only (avoid huge mixed matrices).
   */
  private resolveDriverMetrics(
    surveys: Array<{
      template: SurveyTemplate;
      questions: Array<{
        metric: string | null;
        category: string | null;
        type: string;
        gridRows?: Prisma.JsonValue | null;
      }>;
    }>,
  ): string[] {
    if (!surveys.length) return [...ENG_METRICS];

    if (surveys.length === 1) {
      const survey = surveys[0];
      if (survey.template === SurveyTemplate.FULL) {
        return [...ENG_METRICS];
      }
      const collected = this.collectScaleMetrics(survey.questions);
      return collected.length ? this.orderDriverMetrics(collected) : [...ENG_METRICS];
    }

    return [...ENG_METRICS];
  }

  private pushNormalized(
    metricBuckets: Map<string, number[]>,
    byCategory: {
      engagement: number[];
      loyalty: number[];
      satisfaction: number[];
    },
    metric: string,
    category: string | null | undefined,
    value: number,
    scaleMax: number,
  ) {
    if (value < 1 || value > scaleMax) return;
    const normalized =
      scaleMax === 10 ? 1 + ((value - 1) / 9) * 4 : value;
    const list = metricBuckets.get(metric) || [];
    list.push(normalized);
    metricBuckets.set(metric, list);

    const cat = (category || '').toLowerCase();
    if (cat === 'engagement' || cat === 'pulse') {
      byCategory.engagement.push(normalized);
    } else if (cat === 'loyalty') {
      byCategory.loyalty.push(normalized);
    } else if (cat === 'satisfaction') {
      byCategory.satisfaction.push(normalized);
    } else if (cat === 'importance' || cat === 'profile' || cat === 'open') {
      // skip category indexes
    } else {
      byCategory.engagement.push(normalized);
    }
  }

  private buildRows(
    surveys: Array<{
      questions: Array<{
        id: string;
        metric: string | null;
        category: string | null;
        type: string;
        scaleMax: number;
        gridRows?: Prisma.JsonValue | null;
        gridColumns?: Prisma.JsonValue | null;
      }>;
      responses: Array<{
        id: string;
        completedAt: Date;
        departmentName: string | null;
        grade: string | null;
        enps: number | null;
        answers: Array<{
          questionId: string;
          valueInt: number | null;
          valueJson?: Prisma.JsonValue | null;
        }>;
      }>;
    }>,
  ): AnalyticRow[] {
    const rows: AnalyticRow[] = [];

    for (const survey of surveys) {
      const qMap = new Map(survey.questions.map((q) => [q.id, q]));
      for (const response of survey.responses) {
        const metricBuckets = new Map<string, number[]>();
        const byCategory = {
          engagement: [] as number[],
          loyalty: [] as number[],
          satisfaction: [] as number[],
        };

        for (const answer of response.answers) {
          const q = qMap.get(answer.questionId);
          if (!q || q.type === 'ENPS' || q.type === 'TEXT') continue;

          if (q.type === 'GRID') {
            if (!isGridRows(q.gridRows) || !isGridColumns(q.gridColumns)) continue;
            const gridAnswer = parseGridAnswer(answer.valueJson);
            if (!gridAnswer) continue;
            const colById = new Map(q.gridColumns.map((c) => [c.id, c]));
            for (const row of q.gridRows) {
              const colId = gridAnswer[row.id];
              if (!colId) continue;
              const col = colById.get(colId);
              if (!col || col.value == null) continue;
              const scaleMax = Math.max(
                5,
                ...q.gridColumns
                  .map((c) => c.value)
                  .filter((v): v is number => typeof v === 'number'),
              );
              this.pushNormalized(
                metricBuckets,
                byCategory,
                row.label || q.metric || 'Общее',
                q.category,
                col.value,
                scaleMax <= 5 ? 5 : 10,
              );
            }
            continue;
          }

          if (answer.valueInt == null || answer.valueInt < 1 || answer.valueInt > 10) {
            continue;
          }
          const scaleMax = q.scaleMax === 10 ? 10 : 5;
          this.pushNormalized(
            metricBuckets,
            byCategory,
            q.metric || 'Общее',
            q.category,
            answer.valueInt,
            scaleMax,
          );
        }

        const metrics: Record<string, number> = {};
        for (const [name, vals] of metricBuckets) {
          metrics[name] = round2(mean(vals));
        }

        let enps = response.enps;
        if (enps == null) {
          const enpsQ = survey.questions.find((q) => q.type === 'ENPS');
          if (enpsQ) {
            const a = response.answers.find((x) => x.questionId === enpsQ.id);
            enps = a?.valueInt ?? null;
          }
        }
        if (enps == null) continue;

        rows.push({
          id: response.id,
          date: response.completedAt.toISOString(),
          dept: response.departmentName || 'Без отдела',
          grade: response.grade || '',
          enps,
          engagementIndex: round2(mean(byCategory.engagement)),
          loyaltyIndex: round2(mean(byCategory.loyalty)),
          satisfactionIndex: round2(mean(byCategory.satisfaction)),
          metrics,
        });
      }
    }

    return rows;
  }

  private compute(rows: AnalyticRow[], driverMetrics: string[]) {
    const N = rows.length;
    const metrics = driverMetrics.length ? driverMetrics : [...ENG_METRICS];

    const driverResults = metrics.map((name) => {
      const pairs = rows
        .filter((r) => r.metrics[name] !== undefined)
        .map((r) => ({ x: r.metrics[name], y: r.enps }));
      const n = pairs.length;
      if (n < 5) return { name, r: 0, p: 1, n };
      const r = pearson(
        pairs.map((p) => p.x),
        pairs.map((p) => p.y),
      );
      return { name, r: round2(r), p: pearsonPValue(r, n), n };
    }).sort((a, b) => Math.abs(b.r) - Math.abs(a.r));

    const validRows = rows.filter((r) =>
      metrics.every((m) => r.metrics[m] !== undefined),
    );
    const reg =
      metrics.length >= 2 && validRows.length >= Math.max(15, metrics.length + 5)
        ? multipleRegression(
            validRows.map((r) => metrics.map((m) => r.metrics[m])),
            validRows.map((r) => r.enps),
          )
        : null;

    const regCoefs = reg
      ? metrics.map((name, i) => ({
          name,
          beta: round2(reg.coefficients[i] || 0),
        })).sort((a, b) => Math.abs(b.beta) - Math.abs(a.beta))
      : [];

    const importanceMap: Record<string, number> = {};
    if (regCoefs.length) {
      regCoefs.forEach((c) => {
        importanceMap[c.name] = Math.abs(c.beta);
      });
    } else {
      // Without regression, use |r| with eNPS as importance proxy.
      driverResults.forEach((d) => {
        importanceMap[d.name] = Math.abs(d.r);
      });
    }
    const maxImp = Math.max(...Object.values(importanceMap), 1e-9);
    const scores = metrics.map((name) => {
      const vals = rows
        .map((r) => r.metrics[name])
        .filter((v): v is number => v !== undefined);
      return {
        name,
        score: vals.length ? round2(mean(vals)) : 0,
        importance: round2((importanceMap[name] || 0) / maxImp),
        n: vals.length,
      };
    });
    const scoredForAvg = scores.filter((s) => s.n > 0);
    const avgMetricScore = scoredForAvg.length
      ? mean(scoredForAvg.map((s) => s.score))
      : 0;
    const quadrants = {
      action: scores.filter(
        (s) => s.n > 0 && s.importance >= 0.5 && s.score < avgMetricScore,
      ),
      keep: scores.filter(
        (s) => s.n > 0 && s.importance >= 0.5 && s.score >= avgMetricScore,
      ),
      monitor: scores.filter(
        (s) => s.n > 0 && s.importance < 0.5 && s.score < avgMetricScore,
      ),
      low: scores.filter(
        (s) => s.n > 0 && s.importance < 0.5 && s.score >= avgMetricScore,
      ),
    };

    const corrMatrix = metrics.map((a) =>
      metrics.map((b) => {
        const xs: number[] = [];
        const ys: number[] = [];
        rows.forEach((r) => {
          if (r.metrics[a] !== undefined && r.metrics[b] !== undefined) {
            xs.push(r.metrics[a]);
            ys.push(r.metrics[b]);
          }
        });
        return xs.length >= 5 ? round2(pearson(xs, ys)) : 0;
      }),
    );

    const weekBuckets: Record<
      string,
      { eng: number[]; loy: number[]; sat: number[]; enps: number[] }
    > = {};
    rows.forEach((r) => {
      const k = weekKey(new Date(r.date));
      if (!weekBuckets[k]) weekBuckets[k] = { eng: [], loy: [], sat: [], enps: [] };
      weekBuckets[k].eng.push(r.engagementIndex);
      weekBuckets[k].loy.push(r.loyaltyIndex);
      weekBuckets[k].sat.push(r.satisfactionIndex);
      weekBuckets[k].enps.push(r.enps);
    });
    const weeks = Object.keys(weekBuckets).sort().slice(-12);
    const dynamics = {
      labels: weeks,
      engagement: weeks.map((w) => round2(mean(weekBuckets[w].eng))),
      loyalty: weeks.map((w) => round2(mean(weekBuckets[w].loy))),
      satisfaction: weeks.map((w) => round2(mean(weekBuckets[w].sat))),
      enps: weeks.map((w) => round2(mean(weekBuckets[w].enps))),
    };

    const byDept: Record<
      string,
      { eng: number[]; loy: number[]; sat: number[]; enps: number[] }
    > = {};
    rows.forEach((r) => {
      if (!byDept[r.dept]) byDept[r.dept] = { eng: [], loy: [], sat: [], enps: [] };
      byDept[r.dept].eng.push(r.engagementIndex);
      byDept[r.dept].loy.push(r.loyaltyIndex);
      byDept[r.dept].sat.push(r.satisfactionIndex);
      byDept[r.dept].enps.push(r.enps);
    });
    const segments = Object.entries(byDept)
      .map(([name, v]) => ({
        name,
        n: v.eng.length,
        engagement: round2(mean(v.eng)),
        loyalty: round2(mean(v.loy)),
        satisfaction: round2(mean(v.sat)),
        enps: round2(mean(v.enps)),
      }))
      .sort((a, b) => b.engagement - a.engagement);

    const grades = [...new Set(rows.map((r) => r.grade).filter(Boolean))];

    const heatmap = {
      departments: [...new Set(rows.map((r) => r.dept))],
      metrics: metrics.map((m) => {
        const cells = [...new Set(rows.map((r) => r.dept))].map((d) => {
          const vals = rows
            .filter((r) => r.dept === d && r.metrics[m] !== undefined)
            .map((r) => r.metrics[m]);
          return { dept: d, value: vals.length ? round2(mean(vals)) : null };
        });
        const rowAvg = mean(
          cells.map((c) => c.value).filter((v): v is number => v != null),
        );
        return { name: m, cells, average: round2(rowAvg) };
      }),
    };

    const usesClassicEng = ENG_METRICS.every((m) => metrics.includes(m));
    const alphaDefs = usesClassicEng
      ? [
          { name: 'Вовлечённость', items: ENG_METRICS },
          { name: 'Лояльность', items: LOY_METRICS },
          { name: 'Удовлетворённость', items: SAT_METRICS },
        ]
      : [{ name: 'Метрики опроса', items: metrics }];
    const alpha = alphaDefs.map((def) => {
      const scoreRows = rows
        .map((r) => {
          const row: Record<string, number> = {};
          for (const item of def.items) {
            if (r.metrics[item] === undefined) return null;
            row[item] = r.metrics[item];
          }
          return row;
        })
        .filter((r): r is Record<string, number> => r != null);
      const value =
        def.items.length >= 2 ? cronbachAlpha(scoreRows, def.items) : 0;
      return {
        name: def.name,
        metricsCount: def.items.length,
        alpha: round2(value),
        status: value >= 0.9 ? 'отлично' : value >= 0.7 ? 'приемлемо' : 'низко',
      };
    });

    const alerts: Array<{ level: string; title: string; text: string }> = [];
    if (weeks.length >= 4) {
      const last2 = weeks.slice(-2);
      const prev2 = weeks.slice(-4, -2);
      metrics.forEach((m) => {
        const lastVals: number[] = [];
        const prevVals: number[] = [];
        rows.forEach((r) => {
          if (r.metrics[m] === undefined) return;
          const k = weekKey(new Date(r.date));
          if (last2.includes(k)) lastVals.push(r.metrics[m]);
          else if (prev2.includes(k)) prevVals.push(r.metrics[m]);
        });
        if (lastVals.length >= 3 && prevVals.length >= 3) {
          const lv = mean(lastVals);
          const pv = mean(prevVals);
          if (pv === 0) return;
          const delta = ((lv - pv) / pv) * 100;
          if (delta <= -10) {
            alerts.push({
              level: 'danger',
              title: `Резкое падение: ${m}`,
              text: `Снижение на ${Math.abs(delta).toFixed(0)}% за 2 недели (${pv.toFixed(2)} → ${lv.toFixed(2)}).`,
            });
          } else if (delta <= -5) {
            alerts.push({
              level: 'warn',
              title: `Замедление: ${m}`,
              text: `Снижение на ${Math.abs(delta).toFixed(0)}% за 2 недели.`,
            });
          } else if (delta >= 10) {
            alerts.push({
              level: 'ok',
              title: `Рост: ${m}`,
              text: `Рост на ${delta.toFixed(0)}% за 2 недели.`,
            });
          }
        }
      });
    }
    if (N < 5) {
      alerts.push({
        level: 'warn',
        title: 'Недостаточно данных для драйверов',
        text: `n = ${N}. Корреляции с eNPS считаются при ≥ 5 ответах с eNPS.`,
      });
    } else if (N < 30) {
      alerts.push({
        level: 'warn',
        title: 'Малая выборка',
        text: `n = ${N}. Для устойчивых выводов нужно ≥ 30 ответов.`,
      });
    }
    const overallEnps = mean(rows.map((r) => r.enps));
    if (N && overallEnps < 6) {
      alerts.push({
        level: 'danger',
        title: 'Низкий средний eNPS',
        text: `Средний eNPS = ${overallEnps.toFixed(1)}. Требуется программа удержания.`,
      });
    }
    if (driverResults[0] && Math.abs(driverResults[0].r) > 0.4) {
      const top = driverResults[0];
      const topScore = scores.find((s) => s.name === top.name);
      if (topScore && topScore.score < avgMetricScore) {
        alerts.push({
          level: 'danger',
          title: 'Главный драйвер требует внимания',
          text: `«${top.name}» сильнее всего связана с eNPS (r = ${top.r.toFixed(2)}), но балл ниже среднего.`,
        });
      }
    }

    let engTrend = 0;
    let loyTrend = 0;
    let satTrend = 0;
    let enpsTrend = 0;
    if (weeks.length >= 2) {
      engTrend = dynamics.engagement.at(-1)! - dynamics.engagement.at(-2)!;
      loyTrend = dynamics.loyalty.at(-1)! - dynamics.loyalty.at(-2)!;
      satTrend = dynamics.satisfaction.at(-1)! - dynamics.satisfaction.at(-2)!;
      enpsTrend = dynamics.enps.at(-1)! - dynamics.enps.at(-2)!;
    }

    const promoters = rows.filter((r) => r.enps >= 9).length;
    const detractors = rows.filter((r) => r.enps <= 6).length;

    return {
      N,
      avgEng: round2(mean(rows.map((r) => r.engagementIndex))),
      avgLoy: round2(mean(rows.map((r) => r.loyaltyIndex))),
      avgSat: round2(mean(rows.map((r) => r.satisfactionIndex))),
      avgEnps: round2(overallEnps),
      promoters,
      detractors,
      enpsScore: N
        ? Math.round(((promoters - detractors) / N) * 100)
        : 0,
      engTrend: round2(engTrend),
      loyTrend: round2(loyTrend),
      satTrend: round2(satTrend),
      enpsTrend: round2(enpsTrend),
      driverResults,
      reg: reg
        ? { rSquared: round2(reg.rSquared), intercept: round2(reg.intercept) }
        : null,
      regCoefs,
      scores,
      avgMetricScore: round2(avgMetricScore),
      quadrants,
      corrMatrix,
      dynamics,
      segments,
      grades,
      heatmap,
      alpha,
      alerts,
    };
  }

  private formatAnswerDetail(
    question: {
      type: string;
      scaleMax: number;
      scaleMinLabel?: string | null;
      scaleMaxLabel?: string | null;
      gridRows?: Prisma.JsonValue | null;
      gridColumns?: Prisma.JsonValue | null;
    },
    answer: {
      valueInt: number | null;
      valueText: string | null;
      valueJson?: Prisma.JsonValue | null;
    },
  ) {
    if (question.type === 'TEXT') {
      const text = answer.valueText?.trim() || '';
      return {
        value: text || '—',
        valueInt: null as number | null,
        valueText: text || null,
        scaleMax: null as number | null,
        gridParts: [] as Array<{ row: string; column: string }>,
      };
    }

    if (question.type === 'GRID') {
      if (!isGridRows(question.gridRows) || !isGridColumns(question.gridColumns)) {
        return {
          value: '—',
          valueInt: null,
          valueText: null,
          scaleMax: null,
          gridParts: [],
        };
      }
      const gridAnswer = parseGridAnswer(answer.valueJson);
      if (!gridAnswer) {
        return {
          value: '—',
          valueInt: null,
          valueText: null,
          scaleMax: null,
          gridParts: [],
        };
      }
      const colById = new Map(question.gridColumns.map((c) => [c.id, c]));
      const gridParts = question.gridRows
        .map((row) => {
          const colId = gridAnswer[row.id];
          if (!colId) return null;
          const col = colById.get(colId);
          if (!col) return null;
          return { row: row.label, column: col.label };
        })
        .filter((part): part is { row: string; column: string } => Boolean(part));
      return {
        value: gridParts.length
          ? gridParts.map((p) => `${p.row}: ${p.column}`).join('; ')
          : '—',
        valueInt: null,
        valueText: null,
        scaleMax: null,
        gridParts,
      };
    }

    if (answer.valueInt == null) {
      return {
        value: '—',
        valueInt: null,
        valueText: null,
        scaleMax: null,
        gridParts: [],
      };
    }

    const scaleMax = question.type === 'ENPS' ? 10 : question.scaleMax === 10 ? 10 : 5;
    const labels: string[] = [String(answer.valueInt)];
    if (question.type !== 'ENPS') {
      if (answer.valueInt === 1 && question.scaleMinLabel) {
        labels.push(`(${question.scaleMinLabel})`);
      } else if (answer.valueInt === scaleMax && question.scaleMaxLabel) {
        labels.push(`(${question.scaleMaxLabel})`);
      }
    }
    return {
      value: labels.join(' '),
      valueInt: answer.valueInt,
      valueText: null,
      scaleMax,
      gridParts: [],
    };
  }

  private buildRecentResponses(
    surveys: Array<{
      title: string;
      adminCanIdentifyRespondents: boolean;
      questions: Array<{
        id: string;
        text: string;
        type: string;
        metric: string | null;
        sortOrder: number;
        scaleMax: number;
        scaleMinLabel: string | null;
        scaleMaxLabel: string | null;
        gridRows?: Prisma.JsonValue | null;
        gridColumns?: Prisma.JsonValue | null;
      }>;
      responses: Array<{
        id: string;
        completedAt: Date;
        departmentName: string | null;
        grade: string | null;
        enps: number | null;
        employee: { id: string; fullName: string; email: string | null } | null;
        link: { type: LinkType };
        answers: Array<{
          questionId: string;
          valueInt: number | null;
          valueText: string | null;
          valueJson?: Prisma.JsonValue | null;
        }>;
      }>;
    }>,
    rows: AnalyticRow[],
  ) {
    const indexesById = new Map(rows.map((r) => [r.id, r]));
    const flat = surveys.flatMap((survey) =>
      survey.responses.map((response) => ({ survey, response })),
    );

    return flat
      .sort(
        (a, b) =>
          b.response.completedAt.getTime() - a.response.completedAt.getTime(),
      )
      .slice(0, 30)
      .map(({ survey, response }) => {
        const canIdentify =
          survey.adminCanIdentifyRespondents &&
          response.link.type === LinkType.PERSONAL;
        const indexes = indexesById.get(response.id);
        const answerByQuestion = new Map(
          response.answers.map((a) => [a.questionId, a]),
        );

        return {
          id: response.id,
          date: response.completedAt.toISOString(),
          surveyTitle: survey.title,
          dept: response.departmentName || 'Без отдела',
          grade: response.grade || '',
          engagement: indexes?.engagementIndex ?? null,
          loyalty: indexes?.loyaltyIndex ?? null,
          satisfaction: indexes?.satisfactionIndex ?? null,
          enps: indexes?.enps ?? response.enps,
          anonymous: !canIdentify,
          employee: canIdentify ? response.employee : null,
          answers: survey.questions.map((question) => {
            const answer = answerByQuestion.get(question.id);
            const detail = answer
              ? this.formatAnswerDetail(question, answer)
              : {
                  value: '—',
                  valueInt: null,
                  valueText: null,
                  scaleMax: null,
                  gridParts: [],
                };
            return {
              questionId: question.id,
              text: question.text,
              type: question.type,
              metric: question.metric,
              ...detail,
            };
          }),
        };
      });
  }
}
