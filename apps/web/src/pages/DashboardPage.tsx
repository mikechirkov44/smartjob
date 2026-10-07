import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';

type Analytics = {
  responseCount: number;
  avgScore: number;
  enps: number | null;
  surveys: Array<{ id: string; title: string; status: string; responses: number }>;
};

export function DashboardPage() {
  const { token, organizationId, user } = useAuth();
  const [data, setData] = useState<Analytics | null>(null);

  useEffect(() => {
    if (!organizationId || !token) return;
    void api<Analytics>(`/organizations/${organizationId}/analytics`, {
      token,
      organizationId,
    }).then(setData);
  }, [token, organizationId]);

  if (!organizationId) {
    return (
      <div className="card">
        <h1 className="page-title">Нет организации</h1>
        <p className="page-sub">
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
    <div className="stack">
      <div>
        <h1 className="page-title">Обзор</h1>
        <p className="page-sub">Сводка по опросам выбранной компании.</p>
      </div>
      <div className="grid-2">
        <div className="card">
          <div className="muted">Ответов</div>
          <div style={{ fontSize: 36, fontWeight: 800 }}>{data?.responseCount ?? '—'}</div>
        </div>
        <div className="card">
          <div className="muted">Средняя оценка</div>
          <div style={{ fontSize: 36, fontWeight: 800 }}>{data?.avgScore ?? '—'}</div>
        </div>
        <div className="card">
          <div className="muted">eNPS</div>
          <div style={{ fontSize: 36, fontWeight: 800 }}>
            {data?.enps == null ? '—' : data.enps}
          </div>
        </div>
        <div className="card">
          <div className="muted">Кампаний</div>
          <div style={{ fontSize: 36, fontWeight: 800 }}>{data?.surveys.length ?? '—'}</div>
        </div>
      </div>
      <div className="card">
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
          <h3>Последние опросы</h3>
          <Link className="btn btn-primary btn-sm" to="/surveys/new">
            Создать опрос
          </Link>
        </div>
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
                    <Link to={`/surveys/${s.id}`}>{s.title}</Link>
                  </td>
                  <td>
                    <span className="badge">{s.status}</span>
                  </td>
                  <td>{s.responses}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
