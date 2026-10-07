import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api';
import { useAuth } from '../auth';
import { CustomSelect } from '../components/CustomSelect';
import { COVER_PRESETS } from '../coverPresets';

type Q = { text: string; metric: string; category: string };

export function SurveyCreatePage() {
  const { token, organizationId } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    title: '',
    description: '',
    coverImage: 'team-collab',
    template: 'FULL',
    includeEnps: true,
    adminCanIdentifyRespondents: false,
    closesAt: '',
  });
  const [questions, setQuestions] = useState<Q[]>([
    { text: '', metric: 'Общее', category: 'custom' },
  ]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const body: Record<string, unknown> = {
        title: form.title,
        description: form.description || undefined,
        coverImage: form.coverImage,
        template: form.template,
        includeEnps: form.includeEnps,
        adminCanIdentifyRespondents: form.adminCanIdentifyRespondents,
        closesAt: form.closesAt || undefined,
      };
      if (form.template === 'CUSTOM') {
        body.questions = questions.filter((q) => q.text.trim());
      }
      const survey = await api<{ id: string }>(
        `/organizations/${organizationId}/surveys`,
        { token, organizationId, method: 'POST', body },
      );
      navigate(`/surveys/${survey.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Ошибка создания');
    }
  };

  return (
    <div className="stack">
      <div>
        <h1 className="page-title">Новый опрос</h1>
        <p className="page-sub">Выберите шаблон или соберите свой.</p>
      </div>
      <form className="card stack" onSubmit={onSubmit}>
        <div className="field">
          <label>Название</label>
          <input
            required
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
        </div>
        <div className="field">
          <label>Описание</label>
          <textarea
            rows={3}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </div>
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--muted)' }}>
            Обложка опроса
          </label>
          <div className="cover-grid" style={{ marginTop: 8 }}>
            {COVER_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className={`cover-option ${form.coverImage === preset.id ? 'active' : ''}`}
                onClick={() => setForm((f) => ({ ...f, coverImage: preset.id }))}
              >
                <img src={preset.src} alt={preset.label} />
                <span>{preset.label}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="grid-2">
          <div className="field">
            <label>Шаблон</label>
            <CustomSelect
              className="grow"
              value={form.template}
              placeholder="Шаблон"
              onChange={(template) => setForm((f) => ({ ...f, template }))}
              options={[
                { value: 'FULL', label: 'Полный (29 вопросов + eNPS)' },
                { value: 'PULSE', label: 'Пульс (7 вопросов)' },
                { value: 'CUSTOM', label: 'Свой опрос' },
              ]}
            />
          </div>
          <div className="field">
            <label>Дата закрытия</label>
            <input
              type="datetime-local"
              value={form.closesAt}
              onChange={(e) => setForm((f) => ({ ...f, closesAt: e.target.value }))}
            />
          </div>
        </div>
        <label className="row">
          <input
            type="checkbox"
            checked={form.includeEnps}
            onChange={(e) => setForm((f) => ({ ...f, includeEnps: e.target.checked }))}
          />
          Добавить eNPS
        </label>
        <label className="row">
          <input
            type="checkbox"
            checked={form.adminCanIdentifyRespondents}
            onChange={(e) =>
              setForm((f) => ({ ...f, adminCanIdentifyRespondents: e.target.checked }))
            }
          />
          Админ может видеть, кто ответил (только персональные ссылки)
        </label>

        {form.template === 'CUSTOM' && (
          <div className="stack">
            <h3>Вопросы</h3>
            {questions.map((q, idx) => (
              <div className="card" key={idx}>
                <div className="field">
                  <label>Текст вопроса</label>
                  <input
                    required
                    value={q.text}
                    onChange={(e) =>
                      setQuestions((list) =>
                        list.map((item, i) =>
                          i === idx ? { ...item, text: e.target.value } : item,
                        ),
                      )
                    }
                  />
                </div>
                <div className="grid-2">
                  <div className="field">
                    <label>Метрика</label>
                    <input
                      value={q.metric}
                      onChange={(e) =>
                        setQuestions((list) =>
                          list.map((item, i) =>
                            i === idx ? { ...item, metric: e.target.value } : item,
                          ),
                        )
                      }
                    />
                  </div>
                  <div className="field">
                    <label>Категория</label>
                    <input
                      value={q.category}
                      onChange={(e) =>
                        setQuestions((list) =>
                          list.map((item, i) =>
                            i === idx ? { ...item, category: e.target.value } : item,
                          ),
                        )
                      }
                    />
                  </div>
                </div>
              </div>
            ))}
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() =>
                setQuestions((q) => [...q, { text: '', metric: 'Общее', category: 'custom' }])
              }
            >
              + Вопрос
            </button>
          </div>
        )}

        {error && <div className="error">{error}</div>}
        <button className="btn btn-primary">Создать опрос</button>
      </form>
    </div>
  );
}
