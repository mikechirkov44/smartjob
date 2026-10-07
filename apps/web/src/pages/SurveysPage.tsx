import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';

type Survey = {
  id: string;
  title: string;
  template: string;
  status: string;
  closesAt?: string;
  adminCanIdentifyRespondents: boolean;
  _count: { responses: number; links: number };
  links: Array<{ token: string }>;
};

export function SurveysPage() {
  const { token, organizationId } = useAuth();
  const [items, setItems] = useState<Survey[]>([]);

  useEffect(() => {
    if (!organizationId) return;
    void api<Survey[]>(`/organizations/${organizationId}/surveys`, {
      token,
      organizationId,
    }).then(setItems);
  }, [token, organizationId]);

  return (
    <div className="stack">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Опросы</h1>
          <p className="page-sub">Шаблоны Full/Pulse или свой конструктор.</p>
        </div>
        <Link className="btn btn-primary" to="/surveys/new">
          Создать
        </Link>
      </div>
      <div className="card table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Название</th>
              <th>Шаблон</th>
              <th>Статус</th>
              <th>Ответы</th>
              <th>Ссылка</th>
            </tr>
          </thead>
          <tbody>
            {items.map((s) => (
              <tr key={s.id}>
                <td>
                  <Link to={`/surveys/${s.id}`}>
                    <strong>{s.title}</strong>
                  </Link>
                </td>
                <td>{s.template}</td>
                <td>
                  <span className={`badge ${s.status === 'ACTIVE' ? 'ok' : 'muted'}`}>
                    {s.status}
                  </span>
                </td>
                <td>{s._count.responses}</td>
                <td>
                  {s.links[0] ? (
                    <code>/s/{s.links[0].token.slice(0, 8)}…</code>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
