import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../api';
import { useAuth } from '../auth';
import { SurveyEditor, SurveyFormState } from '../components/SurveyEditor';
import {
  defaultChoices,
  defaultGridColumns,
  defaultGridRows,
  EditorQuestion,
  emptyQuestion,
  GridColumn,
  GridRow,
  kindFromApi,
} from '../questionOptions';
import { statusLabel } from '../statusLabels';

type SurveyPayload = {
  id: string;
  title: string;
  description?: string;
  coverImage?: string;
  template: string;
  status: string;
  includeEnps: boolean;
  hideQuestionCategory?: boolean;
  showAnonymousNotice?: boolean;
  adminCanIdentifyRespondents: boolean;
  closesAt?: string | null;
  _count?: { responses: number };
  questions: Array<{
    id: string;
    text: string;
    metric?: string;
    category?: string;
    type: string;
    scaleMax?: number;
    scaleMinLabel?: string | null;
    scaleMaxLabel?: string | null;
    gridRows?: GridRow[] | null;
    gridColumns?: GridColumn[] | null;
    requireAllRows?: boolean;
    choices?: { id: string; label: string }[] | null;
    allowOther?: boolean;
  }>;
};

function toLocalDatetime(value?: string | null) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function SurveyEditPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { token, organizationId } = useAuth();
  const [error, setError] = useState('');
  const [form, setForm] = useState<SurveyFormState | null>(null);
  const [questions, setQuestions] = useState<EditorQuestion[]>([emptyQuestion()]);
  const [status, setStatus] = useState('DRAFT');
  const [responseCount, setResponseCount] = useState(0);

  useEffect(() => {
    if (!organizationId || !id) return;
    void api<SurveyPayload>(`/organizations/${organizationId}/surveys/${id}`, {
      token,
      organizationId,
    })
      .then((s) => {
        setStatus(s.status);
        setResponseCount(s._count?.responses ?? 0);
        setForm({
          title: s.title,
          description: s.description || '',
          coverImage: s.coverImage || 'team-collab',
          template: s.template,
          includeEnps: s.includeEnps,
          hideQuestionCategory: s.hideQuestionCategory ?? false,
          showAnonymousNotice: s.showAnonymousNotice !== false,
          adminCanIdentifyRespondents: s.adminCanIdentifyRespondents,
          closesAt: toLocalDatetime(s.closesAt),
        });
        const editable = s.questions.filter((q) => q.type !== 'ENPS');
        setQuestions(
          editable.length
            ? editable.map((q) => {
                const kind = kindFromApi(q.type, q.scaleMax);
                return {
                  clientKey: q.id,
                  text: q.text,
                  metric: q.metric || 'Общее',
                  category: q.category || 'custom',
                  kind,
                  scaleMinLabel: q.scaleMinLabel || '',
                  scaleMaxLabel: q.scaleMaxLabel || '',
                  gridRows:
                    q.gridRows && q.gridRows.length
                      ? q.gridRows
                      : defaultGridRows(),
                  gridColumns:
                    q.gridColumns && q.gridColumns.length
                      ? q.gridColumns
                      : defaultGridColumns(),
                  requireAllRows: q.requireAllRows ?? true,
                  choices:
                    q.choices && q.choices.length ? q.choices : defaultChoices(),
                  allowOther: q.allowOther ?? false,
                };
              })
            : [emptyQuestion()],
        );
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Ошибка'));
  }, [token, organizationId, id]);

  if (error) {
    return <div className="card error">{error}</div>;
  }

  if (!form) {
    return <div className="card">Загрузка…</div>;
  }

  return (
    <div className="stack page-enter">
      <Link to={`/surveys/${id}`} className="muted">
        ← К опросу
      </Link>
      <div>
        <h1 className="page-title">Редактирование опроса</h1>
        <p className="page-sub">
          Статус: <strong>{statusLabel(status)}</strong>.{' '}
          {status === 'DRAFT'
            ? 'Можно менять вопросы и настройки.'
            : 'Вопросы заблокированы. Чтобы править состав — на карточке опроса нажмите «Вернуть в черновик».'}
        </p>
      </div>
      <SurveyEditor
        mode="edit"
        surveyId={id}
        initialForm={form}
        initialQuestions={questions}
        allowQuestionEdit
        questionsLocked={status !== 'DRAFT'}
        responseCount={responseCount}
        submitLabel="Сохранить"
        onSuccess={(surveyId) => navigate(`/surveys/${surveyId}`)}
      />
    </div>
  );
}
