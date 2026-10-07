import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  cronbachAlpha,
  mean,
  multipleRegression,
  pearson,
  pearsonPValue,
  round2,
  weekKey,
} from './stats';

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
        questions: true,
        responses: { include: { answers: true } },
      },
    });

    if (surveyId && !surveys.length) {
      throw new NotFoundException('Опрос не найден');
    }

    const rows = this.buildRows(surveys);
    const analytics = this.compute(rows);

    return {
      ...analytics,
      surveys: surveyList.map((s) => ({
        id: s.id,
        title: s.title,
        status: s.status,
      })),
      engMetrics: ENG_METRICS,
      benchmarks: BENCHMARK,
    };
  }

  private buildRows(
    surveys: Array<{
      questions: Array<{
        id: string;
        metric: string | null;
        category: string | null;
        type: string;
      }>;
      responses: Array<{
        id: string;
        completedAt: Date;
        departmentName: string | null;
        grade: string | null;
        enps: number | null;
        answers: Array<{ questionId: string; valueInt: number | null }>;
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
          if (answer.valueInt == null || answer.valueInt < 1 || answer.valueInt > 5) {
            continue;
          }
          const q = qMap.get(answer.questionId);
          if (!q || q.type === 'ENPS') continue;
          const metric = q.metric || 'Общее';
          const list = metricBuckets.get(metric) || [];
          list.push(answer.valueInt);
          metricBuckets.set(metric, list);

          const cat = (q.category || '').toLowerCase();
          if (cat === 'engagement' || cat === 'pulse') {
            byCategory.engagement.push(answer.valueInt);
          } else if (cat === 'loyalty') {
            byCategory.loyalty.push(answer.valueInt);
          } else if (cat === 'satisfaction') {
            byCategory.satisfaction.push(answer.valueInt);
          } else {
            byCategory.engagement.push(answer.valueInt);
          }
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

  private compute(rows: AnalyticRow[]) {
    const N = rows.length;

    const driverResults = ENG_METRICS.map((name) => {
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
      ENG_METRICS.every((m) => r.metrics[m] !== undefined),
    );
    const reg =
      validRows.length >= 15
        ? multipleRegression(
            validRows.map((r) => ENG_METRICS.map((m) => r.metrics[m])),
            validRows.map((r) => r.enps),
          )
        : null;

    const regCoefs = reg
      ? ENG_METRICS.map((name, i) => ({
          name,
          beta: round2(reg.coefficients[i] || 0),
        })).sort((a, b) => Math.abs(b.beta) - Math.abs(a.beta))
      : [];

    const importanceMap: Record<string, number> = {};
    regCoefs.forEach((c) => {
      importanceMap[c.name] = Math.abs(c.beta);
    });
    const maxImp = Math.max(...Object.values(importanceMap), 1e-9);
    const scores = ENG_METRICS.map((name) => {
      const vals = rows
        .map((r) => r.metrics[name])
        .filter((v): v is number => v !== undefined);
      return {
        name,
        score: round2(mean(vals)),
        importance: round2((importanceMap[name] || 0) / maxImp),
      };
    });
    const avgMetricScore = mean(scores.map((s) => s.score));
    const quadrants = {
      action: scores.filter((s) => s.importance >= 0.5 && s.score < avgMetricScore),
      keep: scores.filter((s) => s.importance >= 0.5 && s.score >= avgMetricScore),
      monitor: scores.filter((s) => s.importance < 0.5 && s.score < avgMetricScore),
      low: scores.filter((s) => s.importance < 0.5 && s.score >= avgMetricScore),
    };

    const corrMatrix = ENG_METRICS.map((a) =>
      ENG_METRICS.map((b) => {
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
      metrics: ENG_METRICS.map((m) => {
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

    const alpha = [
      { name: 'Вовлечённость', items: ENG_METRICS },
      { name: 'Лояльность', items: LOY_METRICS },
      { name: 'Удовлетворённость', items: SAT_METRICS },
    ].map((def) => {
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
      const value = cronbachAlpha(scoreRows, def.items);
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
      ENG_METRICS.forEach((m) => {
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
    if (N < 30) {
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
      responses: rows
        .slice()
        .sort((a, b) => b.date.localeCompare(a.date))
        .slice(0, 30)
        .map((r) => ({
          id: r.id,
          date: r.date,
          dept: r.dept,
          grade: r.grade,
          engagement: r.engagementIndex,
          loyalty: r.loyaltyIndex,
          satisfaction: r.satisfactionIndex,
          enps: r.enps,
        })),
    };
  }
}
