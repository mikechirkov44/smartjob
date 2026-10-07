import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { statusBadgeClass, statusLabel } from '../statusLabels';

type Analytics = {
  responseCount: number;
  avgScore: number;
  enps: number | null;
  surveys: Array<{ id: string; title: string; status: string; responses: number }>;
};

export function DashboardPage() {
  const { token, organizationId, user } = useAuth();
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!organizationId || !token) return;
    setLoading(true);
    void api<Analytics>(`/organizations/${organizationId}/analytics`, {
      token,
      organizationId,
    })
      .then(setData)
      .finally(() => setLoading(false));
  }, [token, organizationId]);

  if (!organizationId) {
    return (
      <div className="card empty-state page-enter">
        <img src="/illustrations/empty-surveys.svg" alt="" />
        <h3>Нет организации</h3>
        <p className="page-sub" style={{ marginBottom: 16 }}>
          {user?.globalRole === 'SUPER_ADMIN'
            ? 'Создайте компанию в разделе «Компании».'
            : 'Обратитесь к супер-администратору.'}
        </p>
        {user?.globalRole === 'SUPER_ADMIN' && (
          <Link className="btn btn-primary" to="/super">
            К компаниям
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="stack page-enter">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Обзор</h1>
          <p className="page-sub">Сводка по опросам выбранной компании.</p>
        </div>
        <Link className="btn btn-primary" to="/surveys/new">
          Создать опрос
        </Link>
      </div>

      <div className="grid-4 stagger">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="card skeleton" style={{ height: 110 }} />
            ))
          : (
            <>
              <div className="card kpi-card">
                <div className="kpi-label">Ответов</div>
                <div className="kpi-value">{data?.responseCount ?? 0}</div>
              </div>
              <div className="card kpi-card">
                <div className="kpi-label">Средняя оценка</div>
                <div className="kpi-value">{data?.avgScore ?? '—'}</div>
              </div>
              <div className="card kpi-card">
                <div className="kpi-label">eNPS</div>
                <div className="kpi-value">{data?.enps == null ? '—' : data.enps}</div>
              </div>
              <div className="card kpi-card">
                <div className="kpi-label">Кампаний</div>
                <div className="kpi-value">{data?.surveys.length ?? 0}</div>
              </div>
            </>
          )}
      </div>

      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 20 }}>Последние опросы</h3>
          <Link className="btn btn-secondary btn-sm" to="/surveys">
            Все опросы
          </Link>
        </div>
        {!loading && (data?.surveys.length ?? 0) === 0 ? (
          <div className="empty-state">
            <img src="/illustrations/empty-surveys.svg" alt="" />
            <h3>Пока нет опросов</h3>
            <p className="muted" style={{ marginBottom: 16 }}>
              Создайте первую кампанию — Full, Pulse или свой набор вопросов.
            </p>
            <Link className="btn btn-primary" to="/surveys/new">
              Создать опрос
            </Link>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Название</th>
                  <th>Статус</th>
                  <th>Ответы</th>
                </tr>
              </thead>
              <tbody>
                {(data?.surveys || []).map((s) => (
                  <tr key={s.id}>
                    <td>
                      <Link to={`/surveys/${s.id}`}>
                        <strong>{s.title}</strong>
                      </Link>
                    </td>
                    <td>
                      <span className={`badge ${statusBadgeClass(s.status)}`}>
                        {statusLabel(s.status)}
                      </span>
                    </td>
                    <td>{s.responses}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
