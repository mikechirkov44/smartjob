import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import { useAuth } from '../auth';
import { coverSrc } from '../coverPresets';
import { statusBadgeClass, statusLabel } from '../statusLabels';

type Survey = {
  id: string;
  title: string;
  template: string;
  status: string;
  coverImage?: string;
  closesAt?: string;
  adminCanIdentifyRespondents: boolean;
  _count: { responses: number; links: number };
  links: Array<{ token: string }>;
};

export function SurveysPage() {
  const { token, organizationId } = useAuth();
  const [items, setItems] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!organizationId) return;
    setLoading(true);
    void api<Survey[]>(`/organizations/${organizationId}/surveys`, {
      token,
      organizationId,
    })
      .then(setItems)
      .finally(() => setLoading(false));
  }, [token, organizationId]);

  return (
    <div className="stack page-enter">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div>
          <h1 className="page-title">Опросы</h1>
          <p className="page-sub">Шаблоны Full/Pulse или свой конструктор.</p>
        </div>
        <Link className="btn btn-primary" to="/surveys/new">
          Создать
        </Link>
      </div>

      {loading ? (
        <div className="survey-grid">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card skeleton" style={{ height: 240 }} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="card empty-state">
          <img src="/illustrations/empty-surveys.svg" alt="" />
          <h3>Создайте первый опрос</h3>
          <p className="muted" style={{ marginBottom: 16 }}>
            Выберите обложку, шаблон вопросов и откройте кампанию по ссылке или QR.
          </p>
          <Link className="btn btn-primary" to="/surveys/new">
            Создать опрос
          </Link>
        </div>
      ) : (
        <div className="survey-grid stagger">
          {items.map((s) => (
            <Link
              key={s.id}
              to={`/surveys/${s.id}`}
              className="card survey-card interactive"
            >
              <img
                className="survey-card-cover"
                src={coverSrc(s.coverImage)}
                alt=""
              />
              <div className="survey-card-body">
                <div className="survey-card-title">{s.title}</div>
                <div className="row">
                  <span className={`badge ${statusBadgeClass(s.status)}`}>
                    {statusLabel(s.status)}
                  </span>
                  <span className="badge muted">{s.template}</span>
                </div>
                <div className="survey-card-meta">
                  <span>Ответов: {s._count.responses}</span>
                  {s.links[0] ? <span>Ссылка готова</span> : <span>Без ссылки</span>}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
