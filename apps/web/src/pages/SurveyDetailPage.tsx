import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { api, ApiError } from '../api';
import { useAuth } from '../auth';
import { ConfirmDialog } from '../components/ConfirmDialog';
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
  const navigate = useNavigate();
  const { token, organizationId } = useAuth();
  const [survey, setSurvey] = useState<Survey | null>(null);
  const [employees, setEmployees] = useState<Emp[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [responses, setResponses] = useState<Resp[]>([]);
  const [publicUrl, setPublicUrl] = useState('');
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmDraft, setConfirmDraft] = useState(false);
  const [confirmClearResponses, setConfirmClearResponses] = useState(false);
  const [confirmDeleteResponseId, setConfirmDeleteResponseId] = useState<
    string | null
  >(null);
  const [responsesBusy, setResponsesBusy] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [copied, setCopied] = useState(false);

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
    setStatusBusy(true);
    setError('');
    try {
      await api(`/organizations/${organizationId}/surveys/${id}`, {
        token,
        organizationId,
        method: 'PATCH',
        body: { status },
      });
      setConfirmDraft(false);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось изменить статус');
    } finally {
      setStatusBusy(false);
    }
  };

  const requestReturnToDraft = () => {
    if (!survey) return;
    if (survey._count.responses > 0 || survey.status === 'ACTIVE') {
      setConfirmDraft(true);
      return;
    }
    void setStatus('DRAFT');
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

  const copyLink = async () => {
    if (!publicUrl) return;
    await navigator.clipboard.writeText(publicUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  const removeSurvey = async () => {
    if (!organizationId || !id || !survey) return;
    setDeleting(true);
    setError('');
    try {
      await api(`/organizations/${organizationId}/surveys/${id}`, {
        token,
        organizationId,
        method: 'DELETE',
      });
      navigate('/surveys');
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось удалить');
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const removeResponse = async (responseId: string) => {
    if (!organizationId || !id) return;
    setResponsesBusy(true);
    setError('');
    try {
      await api(
        `/organizations/${organizationId}/surveys/${id}/responses/${responseId}`,
        { token, organizationId, method: 'DELETE' },
      );
      setConfirmDeleteResponseId(null);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось удалить ответ');
    } finally {
      setResponsesBusy(false);
    }
  };

  const clearResponses = async () => {
    if (!organizationId || !id) return;
    setResponsesBusy(true);
    setError('');
    try {
      await api(`/organizations/${organizationId}/surveys/${id}/responses`, {
        token,
        organizationId,
        method: 'DELETE',
      });
      setConfirmClearResponses(false);
      await load();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось очистить ответы');
    } finally {
      setResponsesBusy(false);
    }
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
      {error && <div className="error">{error}</div>}
      <div className="card detail-hero">
        <img
          className="detail-hero-cover"
          src={coverSrc(survey.coverImage)}
          alt=""
        />
        <div className="detail-hero-content">
          <div className="detail-hero-body">
            <h1 className="detail-hero-title">{survey.title}</h1>
            <div className="detail-hero-meta">
              <span className={`badge ${statusBadgeClass(survey.status)}`}>
                {statusLabel(survey.status)}
              </span>
              <span className="badge muted">{survey.template}</span>
              <span className="muted">ответов: {survey._count.responses}</span>
            </div>
            {survey.description && (
              <p className="detail-hero-desc">{survey.description}</p>
            )}
          </div>
          <div className="detail-hero-toolbar">
            <div className="detail-hero-actions">
              {survey.status === 'DRAFT' && (
                <button
                  className="btn btn-primary"
                  disabled={statusBusy}
                  onClick={() => void setStatus('ACTIVE')}
                >
                  Открыть
                </button>
              )}
              {survey.status === 'ACTIVE' && (
                <button
                  className="btn btn-primary"
                  disabled={statusBusy}
                  onClick={() => void setStatus('CLOSED')}
                >
                  Закрыть
                </button>
              )}
              {survey.status === 'CLOSED' && (
                <button
                  className="btn btn-primary"
                  disabled={statusBusy}
                  onClick={() => void setStatus('ACTIVE')}
                >
                  Снова открыть
                </button>
              )}
              <Link className="btn btn-secondary" to={`/surveys/${survey.id}/edit`}>
                Редактировать
              </Link>
              {survey.status !== 'DRAFT' && (
                <button
                  className="btn btn-secondary"
                  disabled={statusBusy}
                  onClick={requestReturnToDraft}
                >
                  Вернуть в черновик
                </button>
              )}
            </div>
            <button
              className="btn btn-danger"
              disabled={deleting}
              onClick={() => setConfirmDelete(true)}
            >
              Удалить
            </button>
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card stack">
          <h3>Публичная ссылка и QR</h3>
          <p className="muted">Общая ссылка — ответы без личности даже для админа.</p>
          <div className="link-box">
            <div className="link-box-url" title={publicUrl}>
              {publicUrl || '—'}
            </div>
            <button
              type="button"
              className={`link-box-copy ${copied ? 'copied' : ''}`}
              onClick={() => void copyLink()}
              disabled={!publicUrl}
            >
              {copied ? 'Скопировано' : 'Копировать'}
            </button>
          </div>
          <div className="link-box-actions">
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
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
          <h3 style={{ margin: 0 }}>Вопросы ({survey.questions.length})</h3>
          <Link className="btn btn-secondary btn-sm" to={`/surveys/${survey.id}/edit`}>
            {survey.status === 'DRAFT' ? 'Изменить вопросы' : 'Открыть редактор'}
          </Link>
        </div>
        {survey.status !== 'DRAFT' && (
          <p className="muted" style={{ marginBottom: 10 }}>
            Состав вопросов меняется только в черновике. Сейчас можно править название, описание,
            обложку и дату закрытия.
          </p>
        )}
        <ol style={{ paddingLeft: 18 }}>
          {survey.questions.map((q) => (
            <li key={q.id} style={{ marginBottom: 8 }}>
              <strong>{q.metric || q.type}</strong> — {q.text}
            </li>
          ))}
        </ol>
      </div>

      <div className="card table-wrap">
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
          <h3 style={{ margin: 0 }}>Ответы ({responses.length})</h3>
          {responses.length > 0 && (
            <button
              type="button"
              className="btn btn-danger btn-sm"
              disabled={responsesBusy}
              onClick={() => setConfirmClearResponses(true)}
            >
              Очистить все
            </button>
          )}
        </div>
        {responses.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            Ответов пока нет
          </p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Дата</th>
                <th>Отдел</th>
                <th>eNPS</th>
                <th>Респондент</th>
                <th />
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
                  <td style={{ textAlign: 'right' }}>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      disabled={responsesBusy}
                      onClick={() => setConfirmDeleteResponseId(r.id)}
                    >
                      Удалить
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        danger
        busy={deleting}
        title="Удалить опрос?"
        message={`Удалить опрос «${survey.title}» вместе со всеми ответами и ссылками? Это действие нельзя отменить.`}
        confirmLabel="Удалить"
        cancelLabel="Отмена"
        onCancel={() => {
          if (!deleting) setConfirmDelete(false);
        }}
        onConfirm={() => void removeSurvey()}
      />

      <ConfirmDialog
        open={confirmDraft}
        busy={statusBusy}
        title="Вернуть в черновик?"
        message={
          survey._count.responses > 0
            ? `Опрос станет черновиком, публичная ссылка перестанет принимать ответы. Уже собрано ответов: ${survey._count.responses}. После правок вопросов аналитика по старым ответам может стать неполной. Продолжить?`
            : 'Опрос станет черновиком: ссылка перестанет принимать ответы, вопросы снова можно будет редактировать.'
        }
        confirmLabel="В черновик"
        cancelLabel="Отмена"
        onCancel={() => {
          if (!statusBusy) setConfirmDraft(false);
        }}
        onConfirm={() => void setStatus('DRAFT')}
      />

      <ConfirmDialog
        open={Boolean(confirmDeleteResponseId)}
        danger
        busy={responsesBusy}
        title="Удалить ответ?"
        message="Ответ будет удалён безвозвратно. Если он был по персональной ссылке, сотрудник сможет пройти опрос снова."
        confirmLabel="Удалить"
        cancelLabel="Отмена"
        onCancel={() => {
          if (!responsesBusy) setConfirmDeleteResponseId(null);
        }}
        onConfirm={() => {
          if (confirmDeleteResponseId) {
            void removeResponse(confirmDeleteResponseId);
          }
        }}
      />

      <ConfirmDialog
        open={confirmClearResponses}
        danger
        busy={responsesBusy}
        title="Очистить все ответы?"
        message={`Удалить все ответы по опросу «${survey.title}» (${responses.length})? Это действие нельзя отменить. Аналитика обнулится.`}
        confirmLabel="Очистить все"
        cancelLabel="Отмена"
        onCancel={() => {
          if (!responsesBusy) setConfirmClearResponses(false);
        }}
        onConfirm={() => void clearResponses()}
      />
    </div>
  );
}
