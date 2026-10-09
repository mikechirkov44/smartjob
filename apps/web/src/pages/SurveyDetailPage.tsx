import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { api, ApiError } from '../api';
import { useAuth } from '../auth';
import { CustomCheckbox } from '../components/CustomCheckbox';
import { coverSrc } from '../coverPresets';
import { statusBadgeClass, statusLabel } from '../statusLabels';

type Survey = {
  id: string;
  title: string;
  description?: string;
  coverImage?: string;
  template: string;
  status: string;
  includeEnps: boolean;
  adminCanIdentifyRespondents: boolean;
  closesAt?: string;
  questions: Array<{ id: string; text: string; metric?: string; type: string }>;
  links: Array<{
    id: string;
    token: string;
    type: string;
    employee?: { id: string; fullName: string } | null;
    _count: { responses: number };
  }>;
  _count: { responses: number };
};

type Emp = { id: string; fullName: string; isActive: boolean };
type Resp = {
  id: string;
  completedAt: string;
  departmentName?: string;
  enps?: number;
  anonymous: boolean;
  employee?: { fullName: string; email?: string } | null;
};

export function SurveyDetailPage() {
  const { id } = useParams();
  const { token, organizationId } = useAuth();
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [employees, setEmployees] = useState<Emp[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [responses, setResponses] = useState<Resp[]>([]);
  const [publicUrl, setPublicUrl] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    if (!organizationId || !id) return;
    const [s, emps, resps, link] = await Promise.all([
      api<Survey>(`/organizations/${organizationId}/surveys/${id}`, {
        token,
        organizationId,
      }),
      api<Emp[]>(`/organizations/${organizationId}/employees`, {
        token,
        organizationId,
      }),
      api<Resp[]>(`/organizations/${organizationId}/surveys/${id}/responses`, {
        token,
        organizationId,
      }),
      api<{ url: string }>(
        `/organizations/${organizationId}/surveys/${id}/public-link`,
        { token, organizationId, method: 'POST' },
      ),
    ]);
    setSurvey(s);
    setEmployees(emps.filter((e) => e.isActive));
    setResponses(resps);
    setPublicUrl(link.url);
  };

  useEffect(() => {
    void load().catch((e) => setError(e instanceof ApiError ? e.message : 'Ошибка'));
  }, [token, organizationId, id]);

  const setStatus = async (status: string) => {
    await api(`/organizations/${organizationId}/surveys/${id}`, {
      token,
      organizationId,
      method: 'PATCH',
      body: { status },
    });
    await load();
  };

  const toggleIdentify = async (value: boolean) => {
    if (!survey) return;
    await api(`/organizations/${organizationId}/surveys/${id}`, {
      token,
      organizationId,
      method: 'PATCH',
      body: { adminCanIdentifyRespondents: value },
    });
    await load();
  };

  const createPersonal = async () => {
    await api(`/organizations/${organizationId}/surveys/${id}/personal-links`, {
      token,
      organizationId,
      method: 'POST',
      body: { employeeIds: selected },
    });
    setSelected([]);
    await load();
  };

  if (!survey) {
    return (
      <div className="card page-enter">
        {error || <div className="skeleton" style={{ height: 24, width: '40%' }} />}
      </div>
    );
  }

  const personalLinks = survey.links.filter((l) => l.type === 'PERSONAL');

  return (
    <div className="stack page-enter">
      <Link to="/surveys" className="muted">
        ← К опросам
      </Link>
      <div className="card detail-hero">
        <img src={coverSrc(survey.coverImage)} alt="" />
        <div className="detail-hero-body">
          <h1 className="page-title" style={{ marginBottom: 8 }}>
            {survey.title}
          </h1>
          <div className="row">
            <span className={`badge ${statusBadgeClass(survey.status)}`}>
              {statusLabel(survey.status)}
            </span>
            <span className="badge muted">{survey.template}</span>
            <span className="muted">ответов: {survey._count.responses}</span>
          </div>
          {survey.description && (
            <p className="muted" style={{ marginTop: 10 }}>
              {survey.description}
            </p>
          )}
        </div>
        <div className="detail-hero-actions row">
          <Link className="btn btn-secondary" to={`/surveys/${survey.id}/edit`}>
            Редактировать
          </Link>
          {survey.status !== 'ACTIVE' && (
            <button className="btn btn-primary" onClick={() => void setStatus('ACTIVE')}>
              Открыть
            </button>
          )}
          {survey.status === 'ACTIVE' && (
            <button className="btn btn-secondary" onClick={() => void setStatus('CLOSED')}>
              Закрыть
            </button>
          )}
        </div>
      </div>

      <div className="grid-2">
        <div className="card stack">
          <h3>Публичная ссылка и QR</h3>
          <p className="muted">Общая ссылка — ответы без личности даже для админа.</p>
          <input readOnly value={publicUrl} onFocus={(e) => e.target.select()} />
          <div className="row">
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => void navigator.clipboard.writeText(publicUrl)}
            >
              Копировать
            </button>
            <a className="btn btn-primary btn-sm" href={publicUrl} target="_blank" rel="noreferrer">
              Открыть
            </a>
          </div>
          {publicUrl && (
            <div style={{ background: '#fff', padding: 16, width: 'fit-content', borderRadius: 12 }}>
              <QRCodeSVG value={publicUrl} size={180} />
            </div>
          )}
        </div>

        <div className="card stack">
          <h3>Настройки анонимности</h3>
          <CustomCheckbox
            variant="toggle"
            checked={survey.adminCanIdentifyRespondents}
            onChange={(value) => void toggleIdentify(value)}
            label="Админ видит личность по персональным ссылкам"
            description="Для сотрудника опрос всегда выглядит анонимным. Идентификация возможна только при персональных ссылках и включённой опции."
          />
          <h4>Персональные ссылки</h4>
          <div className="stack" style={{ maxHeight: 180, overflow: 'auto', gap: 10 }}>
            {employees.map((e) => (
              <CustomCheckbox
                key={e.id}
                id={`emp-${e.id}`}
                checked={selected.includes(e.id)}
                onChange={(checked) =>
                  setSelected((list) =>
                    checked ? [...list, e.id] : list.filter((id) => id !== e.id),
                  )
                }
                label={e.fullName}
              />
            ))}
          </div>
          <button
            className="btn btn-secondary"
            disabled={!selected.length}
            onClick={() => void createPersonal()}
          >
            Создать ссылки
          </button>
          {personalLinks.length > 0 && (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Сотрудник</th>
                    <th>Ссылка</th>
                    <th>Ответил</th>
                  </tr>
                </thead>
                <tbody>
                  {personalLinks.map((l) => (
                    <tr key={l.id}>
                      <td>{l.employee?.fullName || '—'}</td>
                      <td>
                        <a href={`/s/${l.token}`} target="_blank" rel="noreferrer">
                          /s/{l.token.slice(0, 8)}…
                        </a>
                      </td>
                      <td>{l._count.responses > 0 ? 'да' : 'нет'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 10 }}>Вопросы ({survey.questions.length})</h3>
        <ol style={{ paddingLeft: 18 }}>
          {survey.questions.map((q) => (
            <li key={q.id} style={{ marginBottom: 8 }}>
              <strong>{q.metric || q.type}</strong> — {q.text}
            </li>
          ))}
        </ol>
      </div>

      <div className="card table-wrap">
        <h3 style={{ marginBottom: 10 }}>Ответы</h3>
        <table className="table">
          <thead>
            <tr>
              <th>Дата</th>
              <th>Отдел</th>
              <th>eNPS</th>
              <th>Респондент</th>
            </tr>
          </thead>
          <tbody>
            {responses.map((r) => (
              <tr key={r.id}>
                <td>{new Date(r.completedAt).toLocaleString('ru-RU')}</td>
                <td>{r.departmentName || '—'}</td>
                <td>{r.enps ?? '—'}</td>
                <td>
                  {r.anonymous
                    ? 'Анонимно'
                    : r.employee?.fullName || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
