import { useEffect, useMemo, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { api } from '../api';
import { useAuth } from '../auth';
import { CustomSelect } from '../components/CustomSelect';
import './analytics.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  Filler,
);

type Analytics = {
  N: number;
  avgEng: number;
  avgLoy: number;
  avgSat: number;
  avgEnps: number;
  promoters: number;
  enpsScore: number;
  engTrend: number;
  loyTrend: number;
  satTrend: number;
  enpsTrend: number;
  driverResults: Array<{ name: string; r: number; p: number; n: number }>;
  reg: { rSquared: number } | null;
  regCoefs: Array<{ name: string; beta: number }>;
  scores: Array<{ name: string; score: number; importance: number }>;
  avgMetricScore: number;
  quadrants: {
    action: Array<{ name: string }>;
    keep: Array<{ name: string }>;
    monitor: Array<{ name: string }>;
    low: Array<{ name: string }>;
  };
  corrMatrix: number[][];
  dynamics: {
    labels: string[];
    engagement: number[];
    loyalty: number[];
    satisfaction: number[];
    enps: number[];
  };
  segments: Array<{
    name: string;
    n: number;
    engagement: number;
    loyalty: number;
    satisfaction: number;
    enps: number;
  }>;
  grades: string[];
  heatmap: {
    departments: string[];
    metrics: Array<{
      name: string;
      average: number;
      cells: Array<{ dept: string; value: number | null }>;
    }>;
  };
  alpha: Array<{
    name: string;
    metricsCount: number;
    alpha: number;
    status: string;
  }>;
  alerts: Array<{ level: string; title: string; text: string }>;
  responses: Array<{
    id: string;
    date: string;
    dept: string;
    engagement: number;
    loyalty: number;
    satisfaction: number;
    enps: number;
  }>;
  surveys: Array<{ id: string; title: string }>;
  engMetrics: string[];
  benchmarks: Record<string, number>;
};

type Tab = 'overview' | 'drivers' | 'segments' | 'dynamics';

function scoreColor(v: number) {
  if (v >= 4.3) return '#10b981';
  if (v >= 3.7) return '#22c55e';
  if (v >= 3.0) return '#f59e0b';
  if (v >= 2.3) return '#f97316';
  return '#ef4444';
}

function Trend({ delta }: { delta: number }) {
  if (Math.abs(delta) < 0.05) {
    return <span style={{ color: 'var(--muted)', fontWeight: 700 }}>→ 0.00</span>;
  }
  const up = delta > 0;
  return (
    <span style={{ fontWeight: 700, color: up ? 'var(--success)' : 'var(--danger)' }}>
      {up ? '↑' : '↓'} {Math.abs(delta).toFixed(2)}
    </span>
  );
}

export function AnalyticsPage() {
  const { token, organizationId } = useAuth();
  const [surveyId, setSurveyId] = useState('');
  const [tab, setTab] = useState<Tab>('overview');
  const [data, setData] = useState<Analytics | null>(null);
  const [deptFilter, setDeptFilter] = useState('');
  const [gradeFilter, setGradeFilter] = useState('');

  useEffect(() => {
    if (!organizationId) return;
    const q = surveyId ? `?surveyId=${surveyId}` : '';
    void api<Analytics>(`/organizations/${organizationId}/analytics${q}`, {
      token,
      organizationId,
    }).then(setData);
  }, [token, organizationId, surveyId]);

  const filteredSegments = useMemo(() => {
    if (!data) return [];
    return data.segments.filter((s) => !deptFilter || s.name === deptFilter);
  }, [data, deptFilter]);

  const exportInsights = () => {
    if (!data) return;
    let t = 'SmartJob Analytics — экспорт\n';
    t += `Ответов: ${data.N}\n`;
    t += `eNPS: ${data.avgEnps} (score ${data.enpsScore})\n`;
    t += `Вовлечённость: ${data.avgEng}\nЛояльность: ${data.avgLoy}\nУдовлетворённость: ${data.avgSat}\n\n`;
    t += 'ТОП ДРАЙВЕРОВ eNPS:\n';
    data.driverResults.slice(0, 10).forEach((d, i) => {
      t += `${i + 1}. ${d.name}: r=${d.r}, p=${d.p.toFixed(3)}\n`;
    });
    t += '\nАЛЕРТЫ:\n';
    data.alerts.forEach((a) => {
      t += `[${a.level}] ${a.title}\n  ${a.text}\n`;
    });
    const blob = new Blob([t], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'smartjob-insights.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!data) {
    return <div className="card">Загрузка аналитики…</div>;
  }

  const maxR = Math.max(...data.driverResults.map((d) => Math.abs(d.r)), 0.01);
  const short = Object.fromEntries(
    (data.engMetrics || []).map((m) => [m, m.slice(0, 3)]),
  );

  return (
    <div className="stack">
      <div className="analytics-head">
        <div>
          <h1 className="page-title">Аналитика</h1>
          <p className="page-sub">
            Драйверный анализ, регрессия, матрица приоритетов и динамика — на ваших данных
          </p>
        </div>
        <div className="row">
          <CustomSelect
            value={surveyId}
            placeholder="Все опросы"
            ariaLabel="Фильтр опросов"
            onChange={setSurveyId}
            options={[
              { value: '', label: 'Все опросы' },
              ...data.surveys.map((s) => ({ value: s.id, label: s.title })),
            ]}
          />
          <button className="btn btn-secondary" onClick={exportInsights}>
            Экспорт
          </button>
        </div>
      </div>

      <div className="analytics-tabs">
        {(
          [
            ['overview', 'Обзор'],
            ['drivers', 'Драйверы'],
            ['segments', 'Сегменты'],
            ['dynamics', 'Динамика'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={tab === id ? 'active' : ''}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview' && (
        <>
          <div className="kpi-grid">
            <div className="kpi amber">
              <div className="kpi-label">Средний eNPS</div>
              <div className="kpi-val">{data.avgEnps.toFixed(1)}</div>
              <div className="kpi-sub">
                <Trend delta={data.enpsTrend} /> промоутеров:{' '}
                {data.N ? Math.round((data.promoters / data.N) * 100) : 0}%
              </div>
            </div>
            <div className="kpi">
              <div className="kpi-label">Вовлечённость</div>
              <div className="kpi-val">{data.avgEng.toFixed(2)}</div>
              <div className="kpi-sub">
                <Trend delta={data.engTrend} /> из 5.0
              </div>
            </div>
            <div className="kpi cyan">
              <div className="kpi-label">Лояльность</div>
              <div className="kpi-val">{data.avgLoy.toFixed(2)}</div>
              <div className="kpi-sub">
                <Trend delta={data.loyTrend} /> из 5.0
              </div>
            </div>
            <div className="kpi pink">
              <div className="kpi-label">Удовлетворённость</div>
              <div className="kpi-val">{data.avgSat.toFixed(2)}</div>
              <div className="kpi-sub">
                <Trend delta={data.satTrend} /> из 5.0
              </div>
            </div>
          </div>

          <div className="stat-strip">
            <div className="stat-cell">
              <div className="lbl">Ответов</div>
              <div className="val">{data.N}</div>
              <div className="hint">в выборке</div>
            </div>
            <div className="stat-cell">
              <div className="lbl">Отделов</div>
              <div className="val">{data.segments.length}</div>
              <div className="hint">с данными</div>
            </div>
            <div className="stat-cell">
              <div className="lbl">Значимых драйверов</div>
              <div className="val">
                {data.driverResults.filter((d) => d.p < 0.05).length}
              </div>
              <div className="hint">p &lt; 0.05</div>
            </div>
            <div className="stat-cell">
              <div className="lbl">R² модели</div>
              <div className="val">
                {data.reg ? data.reg.rSquared.toFixed(2) : '—'}
              </div>
              <div className="hint">объяснённая дисперсия</div>
            </div>
          </div>

          <div className="card">
            <h3 style={{ marginBottom: 14 }}>Heatmap: метрики × отделы</h3>
            <div className="heatmap">
              <table>
                <thead>
                  <tr>
                    <th>Метрика</th>
                    {data.heatmap.departments.map((d) => (
                      <th key={d}>{d}</th>
                    ))}
                    <th>Среднее</th>
                  </tr>
                </thead>
                <tbody>
                  {data.heatmap.metrics.map((m) => (
                    <tr key={m.name}>
                      <td>{m.name}</td>
                      {m.cells.map((c) => (
                        <td
                          key={c.dept}
                          className="value"
                          style={{
                            background: c.value == null ? '#e2e8f0' : scoreColor(c.value),
                          }}
                        >
                          {c.value == null ? '—' : c.value.toFixed(2)}
                        </td>
                      ))}
                      <td
                        className="value"
                        style={{ background: scoreColor(m.average || 0) }}
                      >
                        {(m.average || 0).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="grid-2">
            <div className="card">
              <h3 style={{ marginBottom: 12 }}>α Кронбаха</h3>
              <table className="table">
                <thead>
                  <tr>
                    <th>Индекс</th>
                    <th>Метрик</th>
                    <th>α</th>
                    <th>Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {data.alpha.map((a) => (
                    <tr key={a.name}>
                      <td>{a.name}</td>
                      <td>{a.metricsCount}</td>
                      <td>{a.alpha.toFixed(3)}</td>
                      <td>
                        <span className={`badge ${a.status === 'низко' ? 'warn' : 'ok'}`}>
                          {a.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="card">
              <h3 style={{ marginBottom: 12 }}>Бенчмарки</h3>
              {[
                { name: 'Вовлечённость', val: data.avgEng, bm: data.benchmarks['Вовлечённость'] },
                { name: 'Лояльность', val: data.avgLoy, bm: data.benchmarks['Лояльность'] },
                {
                  name: 'Удовлетворённость',
                  val: data.avgSat,
                  bm: data.benchmarks['Удовлетворённость'],
                },
                {
                  name: 'eNPS',
                  val: (data.avgEnps / 10) * 5,
                  bm: (data.benchmarks.eNPS / 10) * 5,
                  label: data.avgEnps.toFixed(1),
                },
              ].map((r) => (
                <div className="bench-row" key={r.name}>
                  <div className="bench-name">{r.name}</div>
                  <div className="bench-track">
                    <div
                      className="bench-fill"
                      style={{
                        width: `${Math.min(100, (r.val / 5) * 100)}%`,
                        background: scoreColor(r.val),
                      }}
                    >
                      {'label' in r && r.label ? r.label : r.val.toFixed(2)}
                    </div>
                    <div
                      className="bench-mark"
                      style={{ left: `${Math.min(100, (r.bm / 5) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card table-wrap">
            <h3 style={{ marginBottom: 12 }}>Последние ответы</h3>
            <table className="table">
              <thead>
                <tr>
                  <th>Дата</th>
                  <th>Отдел</th>
                  <th>Вовлеч.</th>
                  <th>Лояльн.</th>
                  <th>Удовл.</th>
                  <th>eNPS</th>
                </tr>
              </thead>
              <tbody>
                {data.responses.map((r) => (
                  <tr key={r.id}>
                    <td>{new Date(r.date).toLocaleDateString('ru-RU')}</td>
                    <td>{r.dept}</td>
                    <td style={{ color: scoreColor(r.engagement), fontWeight: 700 }}>
                      {r.engagement.toFixed(2)}
                    </td>
                    <td style={{ color: scoreColor(r.loyalty), fontWeight: 700 }}>
                      {r.loyalty.toFixed(2)}
                    </td>
                    <td style={{ color: scoreColor(r.satisfaction), fontWeight: 700 }}>
                      {r.satisfaction.toFixed(2)}
                    </td>
                    <td style={{ fontWeight: 700 }}>{r.enps}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'drivers' && (
        <>
          <div className="grid-2">
            <div className="card">
              <h3 style={{ marginBottom: 12 }}>Драйверы eNPS</h3>
              <div className="driver-list">
                {data.driverResults.map((d, i) => {
                  const pct = (Math.abs(d.r) / maxR) * 100;
                  const sig =
                    d.p < 0.01 ? '***' : d.p < 0.05 ? '**' : d.p < 0.1 ? '*' : 'ns';
                  return (
                    <div className={`driver-row ${i < 3 ? 'top' : ''}`} key={d.name}>
                      <div className="driver-rank">{i + 1}</div>
                      <div className="driver-name">{d.name}</div>
                      <div className="driver-bar-wrap">
                        <div className="driver-bar" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="driver-val">{d.r.toFixed(2)}</div>
                      <div className={`driver-sig ${d.p < 0.05 ? 'sig-star' : 'sig-ns'}`}>
                        {sig}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="card">
              <h3 style={{ marginBottom: 12 }}>Матрица приоритетов</h3>
              <p className="muted" style={{ marginBottom: 8 }}>
                Важность (β) × текущий балл. Средний балл: {data.avgMetricScore.toFixed(2)}
              </p>
              <div className="quad-legend">
                <div className="quad">
                  <h4>Действовать ({data.quadrants.action.length})</h4>
                  <p>важно и низкий балл: {data.quadrants.action.map((x) => x.name).join(', ') || '—'}</p>
                </div>
                <div className="quad">
                  <h4>Удерживать ({data.quadrants.keep.length})</h4>
                  <p>важно и высокий балл: {data.quadrants.keep.map((x) => x.name).join(', ') || '—'}</p>
                </div>
                <div className="quad">
                  <h4>Мониторить ({data.quadrants.monitor.length})</h4>
                  <p>{data.quadrants.monitor.map((x) => x.name).join(', ') || '—'}</p>
                </div>
                <div className="quad">
                  <h4>Низкий приоритет ({data.quadrants.low.length})</h4>
                  <p>{data.quadrants.low.map((x) => x.name).join(', ') || '—'}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid-2">
            <div className="card table-wrap">
              <h3 style={{ marginBottom: 12 }}>Корреляционная матрица</h3>
              <table className="table">
                <thead>
                  <tr>
                    <th></th>
                    {(data.engMetrics || []).map((m) => (
                      <th key={m} style={{ fontSize: 10 }}>
                        {short[m]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(data.engMetrics || []).map((row, i) => (
                    <tr key={row}>
                      <td style={{ fontWeight: 600 }}>{row}</td>
                      {(data.corrMatrix[i] || []).map((v, j) => (
                        <td
                          key={j}
                          style={{
                            background: `rgba(99,102,241,${Math.min(0.85, Math.abs(v))})`,
                            color: Math.abs(v) > 0.45 ? '#fff' : 'var(--text)',
                            fontWeight: 700,
                            textAlign: 'center',
                          }}
                        >
                          {v.toFixed(2)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="card table-wrap">
              <h3 style={{ marginBottom: 12 }}>
                Регрессия OLS {data.reg ? `(R²=${data.reg.rSquared.toFixed(2)})` : '(недостаточно данных)'}
              </h3>
              <table className="table">
                <thead>
                  <tr>
                    <th>Метрика</th>
                    <th>β</th>
                    <th>Влияние</th>
                  </tr>
                </thead>
                <tbody>
                  {data.regCoefs.map((c) => (
                    <tr key={c.name}>
                      <td>{c.name}</td>
                      <td style={{ fontWeight: 700 }}>{c.beta.toFixed(3)}</td>
                      <td>
                        <div className="driver-bar-wrap" style={{ width: 120 }}>
                          <div
                            className="driver-bar"
                            style={{
                              width: `${Math.min(100, Math.abs(c.beta) * 100)}%`,
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!data.regCoefs.length && (
                    <tr>
                      <td colSpan={3} className="muted">
                        Нужно ≥ 15 полных ответов с метриками вовлечённости
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === 'segments' && (
        <>
          <div className="filter-row">
            <label>Отдел</label>
            <CustomSelect
              className="sm"
              value={deptFilter}
              placeholder="Все"
              ariaLabel="Фильтр отдела"
              onChange={setDeptFilter}
              options={[
                { value: '', label: 'Все' },
                ...data.segments.map((s) => ({ value: s.name, label: s.name })),
              ]}
            />
            <label>Грейд</label>
            <CustomSelect
              className="sm"
              value={gradeFilter}
              placeholder="Все"
              ariaLabel="Фильтр грейда"
              onChange={setGradeFilter}
              options={[
                { value: '', label: 'Все' },
                ...data.grades.map((g) => ({ value: g, label: g })),
              ]}
            />
          </div>
          <div className="card table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Отдел</th>
                  <th>n</th>
                  <th>Вовлеч.</th>
                  <th>Лояльн.</th>
                  <th>Удовл.</th>
                  <th>eNPS</th>
                </tr>
              </thead>
              <tbody>
                {filteredSegments.map((s) => (
                  <tr key={s.name}>
                    <td>{s.name}</td>
                    <td>{s.n}</td>
                    <td style={{ color: scoreColor(s.engagement), fontWeight: 700 }}>
                      {s.engagement.toFixed(2)}
                    </td>
                    <td style={{ color: scoreColor(s.loyalty), fontWeight: 700 }}>
                      {s.loyalty.toFixed(2)}
                    </td>
                    <td style={{ color: scoreColor(s.satisfaction), fontWeight: 700 }}>
                      {s.satisfaction.toFixed(2)}
                    </td>
                    <td style={{ fontWeight: 700 }}>{s.enps.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'dynamics' && (
        <>
          <div className="card">
            <h3 style={{ marginBottom: 12 }}>Динамика индексов</h3>
            <div className="chart-wrap">
              <Line
                data={{
                  labels: data.dynamics.labels,
                  datasets: [
                    {
                      label: 'Вовлечённость',
                      data: data.dynamics.engagement,
                      borderColor: '#6366f1',
                      backgroundColor: 'rgba(99,102,241,.12)',
                      tension: 0.3,
                      fill: false,
                    },
                    {
                      label: 'Лояльность',
                      data: data.dynamics.loyalty,
                      borderColor: '#06b6d4',
                      tension: 0.3,
                      fill: false,
                    },
                    {
                      label: 'Удовлетворённость',
                      data: data.dynamics.satisfaction,
                      borderColor: '#ec4899',
                      tension: 0.3,
                      fill: false,
                    },
                    {
                      label: 'eNPS (ср.)',
                      data: data.dynamics.enps,
                      borderColor: '#f59e0b',
                      tension: 0.3,
                      fill: false,
                      yAxisID: 'y1',
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: {
                    y: { min: 1, max: 5, position: 'left' },
                    y1: {
                      min: 0,
                      max: 10,
                      position: 'right',
                      grid: { drawOnChartArea: false },
                    },
                  },
                }}
              />
            </div>
          </div>
          <div className="card">
            <h3 style={{ marginBottom: 12 }}>Алерты и наблюдения</h3>
            {data.alerts.length === 0 ? (
              <div className="alert ok">
                <div>
                  <h4>Всё стабильно</h4>
                  <p>Аномалий не обнаружено.</p>
                </div>
              </div>
            ) : (
              data.alerts.map((a, i) => (
                <div className={`alert ${a.level}`} key={i}>
                  <div>
                    <h4>{a.title}</h4>
                    <p>{a.text}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
