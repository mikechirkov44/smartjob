import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, ApiError } from '../api';
import { coverSrc } from '../coverPresets';
import { OTHER_CHOICE_ID, type ChoiceOption, type GridColumn, type GridRow } from '../questionOptions';
import './public-survey.css';

type Question = {
  id: string;
  text: string;
  metric?: string;
  category?: string;
  type: 'LIKERT' | 'ENPS' | 'TEXT' | 'GRID' | 'SINGLE' | 'MULTI';
  scaleMax?: number;
  scaleMinLabel?: string | null;
  scaleMaxLabel?: string | null;
  gridRows?: GridRow[] | null;
  gridColumns?: GridColumn[] | null;
  requireAllRows?: boolean;
  choices?: ChoiceOption[] | null;
  allowOther?: boolean;
};

type AnswerValue = {
  valueInt?: number;
  valueText?: string;
  valueJson?: Record<string, string>;
};

type Payload = {
  organizationName: string;
  anonymousNotice: string;
  alreadyCompleted?: boolean;
  survey: {
    id: string;
    title: string;
    description?: string;
    coverImage?: string;
    hideQuestionCategory?: boolean;
    showAnonymousNotice?: boolean;
    questions: Question[];
  };
};

export function PublicSurveyPage() {
  const { token } = useParams();
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState('');
  const [started, setStarted] = useState(false);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({});
  const [textDraft, setTextDraft] = useState('');
  const [gridDraft, setGridDraft] = useState<Record<string, string>>({});
  const [choiceId, setChoiceId] = useState('');
  const [multiIds, setMultiIds] = useState<string[]>([]);
  const [otherText, setOtherText] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    void api<Payload>(`/public/surveys/${token}`)
      .then(setData)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Ошибка'));
  }, [token]);

  const questions = data?.survey.questions || [];
  const current = questions[idx];
  const progress = useMemo(
    () => (questions.length ? Math.round((idx / questions.length) * 100) : 0),
    [idx, questions.length],
  );

  useEffect(() => {
    if (!current) return;
    if (current.type === 'TEXT') {
      setTextDraft(answers[current.id]?.valueText || '');
    }
    if (current.type === 'GRID') {
      setGridDraft(answers[current.id]?.valueJson || {});
    }
    if (current.type === 'SINGLE') {
      const saved = answers[current.id]?.valueJson;
      setChoiceId(saved?.choiceId || '');
      setOtherText(saved?.otherText || '');
    }
    if (current.type === 'MULTI') {
      const saved = answers[current.id]?.valueJson;
      setMultiIds(
        (saved?.choiceIds || '')
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean),
      );
      setOtherText(saved?.otherText || '');
    }
  }, [current?.id]);

  const submitAll = async (nextAnswers: Record<string, AnswerValue>) => {
    if (!token) return;
    setBusy(true);
    try {
      await api(`/public/surveys/${token}/submit`, {
        method: 'POST',
        body: {
          answers: Object.entries(nextAnswers).map(([questionId, value]) => ({
            questionId,
            valueInt: value.valueInt,
            valueText: value.valueText,
            valueJson: value.valueJson,
          })),
        },
      });
      setDone(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Не удалось отправить');
    } finally {
      setBusy(false);
    }
  };

  const advance = async (nextAnswers: Record<string, AnswerValue>) => {
    setAnswers(nextAnswers);
    if (idx < questions.length - 1) {
      setIdx((i) => i + 1);
      return;
    }
    await submitAll(nextAnswers);
  };

  const choose = async (value: number) => {
    if (!current || !token || !data) return;
    await advance({ ...answers, [current.id]: { valueInt: value } });
  };

  const submitText = async (e: FormEvent) => {
    e.preventDefault();
    if (!current || !textDraft.trim()) return;
    await advance({
      ...answers,
      [current.id]: { valueText: textDraft.trim() },
    });
  };

  const submitChoice = async (e: FormEvent) => {
    e.preventDefault();
    if (!current || !choiceId) return;
    if (choiceId === OTHER_CHOICE_ID && !otherText.trim()) return;
    await advance({
      ...answers,
      [current.id]: {
        valueJson: {
          choiceId,
          ...(choiceId === OTHER_CHOICE_ID ? { otherText: otherText.trim() } : {}),
        },
      },
    });
  };

  const toggleMulti = (id: string) => {
    setMultiIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const submitMulti = async (e: FormEvent) => {
    e.preventDefault();
    if (!current || !multiIds.length) return;
    if (multiIds.includes(OTHER_CHOICE_ID) && !otherText.trim()) return;
    await advance({
      ...answers,
      [current.id]: {
        valueJson: {
          choiceIds: multiIds.join(','),
          ...(multiIds.includes(OTHER_CHOICE_ID) ? { otherText: otherText.trim() } : {}),
        },
      },
    });
  };

  const submitGrid = async (e: FormEvent) => {
    e.preventDefault();
    if (!current) return;
    const rows = current.gridRows || [];
    if (current.requireAllRows !== false) {
      if (!rows.every((r) => gridDraft[r.id])) return;
    } else if (!Object.keys(gridDraft).length) {
      return;
    }
    await advance({
      ...answers,
      [current.id]: { valueJson: { ...gridDraft } },
    });
  };

  if (error) {
    return (
      <div className="public-wrap">
        <div className="public-card thankyou">
          <img src="/illustrations/unavailable.svg" alt="" className="cover-img" />
          <div className="thankyou-body">
            <h1>Опрос недоступен</h1>
            <p>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="public-wrap">
        <div className="public-card">Загрузка…</div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="public-wrap">
        <div className="public-card thankyou">
          <img src="/illustrations/celebrate.svg" alt="" className="cover-img" />
          <div className="thankyou-body">
            <h1>Спасибо!</h1>
            <p>
              Ваши ответы сохранены.
              {data.survey.showAnonymousNotice !== false &&
                ' Опрос анонимный для коллег.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (data.alreadyCompleted) {
    return (
      <div className="public-wrap">
        <div className="public-card thankyou">
          <img src="/illustrations/celebrate.svg" alt="" className="cover-img" />
          <div className="thankyou-body">
            <h1>Опрос уже пройден</h1>
            <p>
              Вы уже отправили ответы по этой ссылке. Пройти ещё раз можно только
              после того, как администратор удалит ваш результат.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (!started) {
    return (
      <div className="public-wrap">
        <div className="public-card intro">
          <img
            src={coverSrc(data.survey.coverImage)}
            alt=""
            className="cover-img"
          />
          <div className="intro-body">
            <div className="public-org">{data.organizationName}</div>
            <h1>{data.survey.title}</h1>
            {data.survey.description && (
              <p className="intro-desc">{data.survey.description}</p>
            )}
            {data.survey.showAnonymousNotice !== false && (
              <p className="anon">{data.anonymousNotice}</p>
            )}
            <p className="muted">Вопросов: {questions.length}</p>
            <button className="btn btn-primary start-btn" onClick={() => setStarted(true)}>
              Начать опрос
            </button>
          </div>
        </div>
      </div>
    );
  }

  const scaleMax = current?.type === 'ENPS' ? 10 : current?.scaleMax === 10 ? 10 : 5;
  const min = current?.type === 'ENPS' ? 0 : 1;
  const options = Array.from({ length: scaleMax - min + 1 }, (_, i) => min + i);
  const tagClass =
    current?.category === 'loyalty'
      ? 'loyalty'
      : current?.category === 'satisfaction'
        ? 'satisfaction'
        : current?.category === 'pulse'
          ? 'pulse'
          : current?.category === 'importance'
            ? 'importance'
            : '';

  const defaultMinLabel =
    current?.type === 'ENPS'
      ? 'точно нет'
      : scaleMax === 10
        ? 'минимально'
        : 'совершенно не согласен';
  const defaultMaxLabel =
    current?.type === 'ENPS'
      ? 'обязательно да'
      : scaleMax === 10
        ? 'максимально'
        : 'полностью согласен';
  const minLabel = current?.scaleMinLabel?.trim() || defaultMinLabel;
  const maxLabel = current?.scaleMaxLabel?.trim() || defaultMaxLabel;
  const hint =
    current?.type === 'TEXT'
      ? 'Введите ответ своими словами'
      : current?.type === 'SINGLE'
        ? 'Выберите один вариант'
        : current?.type === 'MULTI'
          ? 'Отметьте один или несколько вариантов'
          : current?.type === 'GRID'
        ? current.requireAllRows === false
          ? 'Отметьте оценку в нужных строках'
          : 'Отметьте оценку в каждой строке'
        : `${min} — ${minLabel}, ${scaleMax} — ${maxLabel}`;

  const gridRows = current?.gridRows || [];
  const gridColumns = current?.gridColumns || [];
  const gridComplete =
    current?.type === 'GRID' &&
    (current.requireAllRows === false
      ? Object.keys(gridDraft).length > 0
      : gridRows.every((r) => Boolean(gridDraft[r.id])));

  return (
    <div className="public-wrap">
      <div className="public-top">
        <div>
          <div className="public-org">{data.organizationName}</div>
          <h1>{data.survey.title}</h1>
        </div>
        <div className="progress">
          <div className="progress-meta">
            <span>
              Вопрос {idx + 1} / {questions.length}
            </span>
            <span>{progress}%</span>
          </div>
          <div className="progress-bar">
            <div style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      <div className="public-card question" key={current?.id}>
        {!data.survey.hideQuestionCategory && (
          <div className={`q-tag ${tagClass}`}>{current?.metric || current?.type}</div>
        )}
        <h2>{current?.text}</h2>
        <p className="hint">{hint}</p>

        {current?.type === 'TEXT' ? (
          <form className="text-answer" onSubmit={(e) => void submitText(e)}>
            <textarea
              rows={4}
              value={textDraft}
              onChange={(e) => setTextDraft(e.target.value)}
              placeholder="Ваш ответ…"
              required
              disabled={busy}
            />
            <button
              className="btn btn-primary"
              type="submit"
              disabled={busy || !textDraft.trim()}
            >
              {idx < questions.length - 1 ? 'Далее' : 'Отправить'}
            </button>
          </form>
        ) : current?.type === 'SINGLE' ? (
          <form className="choice-answer" onSubmit={(e) => void submitChoice(e)}>
            {(current.choices || []).map((choice) => (
              <label
                key={choice.id}
                className={`choice-option ${choiceId === choice.id ? 'selected' : ''}`}
              >
                <input
                  type="radio"
                  name={`choice-${current.id}`}
                  checked={choiceId === choice.id}
                  disabled={busy}
                  onChange={() => setChoiceId(choice.id)}
                />
                <span>{choice.label}</span>
              </label>
            ))}
            {current.allowOther && (
              <label
                className={`choice-option ${choiceId === OTHER_CHOICE_ID ? 'selected' : ''}`}
              >
                <input
                  type="radio"
                  name={`choice-${current.id}`}
                  checked={choiceId === OTHER_CHOICE_ID}
                  disabled={busy}
                  onChange={() => setChoiceId(OTHER_CHOICE_ID)}
                />
                <span>Другое</span>
              </label>
            )}
            {current.allowOther && choiceId === OTHER_CHOICE_ID && (
              <input
                className="choice-other-input"
                value={otherText}
                disabled={busy}
                placeholder="Свой вариант"
                onChange={(e) => setOtherText(e.target.value)}
                required
              />
            )}
            <button
              className="btn btn-primary"
              type="submit"
              disabled={
                busy ||
                !choiceId ||
                (choiceId === OTHER_CHOICE_ID && !otherText.trim())
              }
            >
              {idx < questions.length - 1 ? 'Далее' : 'Отправить'}
            </button>
          </form>
        ) : current?.type === 'MULTI' ? (
          <form className="choice-answer" onSubmit={(e) => void submitMulti(e)}>
            {(current.choices || []).map((choice) => (
              <label
                key={choice.id}
                className={`choice-option ${multiIds.includes(choice.id) ? 'selected' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={multiIds.includes(choice.id)}
                  disabled={busy}
                  onChange={() => toggleMulti(choice.id)}
                />
                <span>{choice.label}</span>
              </label>
            ))}
            {current.allowOther && (
              <label
                className={`choice-option ${
                  multiIds.includes(OTHER_CHOICE_ID) ? 'selected' : ''
                }`}
              >
                <input
                  type="checkbox"
                  checked={multiIds.includes(OTHER_CHOICE_ID)}
                  disabled={busy}
                  onChange={() => toggleMulti(OTHER_CHOICE_ID)}
                />
                <span>Другое</span>
              </label>
            )}
            {current.allowOther && multiIds.includes(OTHER_CHOICE_ID) && (
              <input
                className="choice-other-input"
                value={otherText}
                disabled={busy}
                placeholder="Свой вариант"
                onChange={(e) => setOtherText(e.target.value)}
                required
              />
            )}
            <button
              className="btn btn-primary"
              type="submit"
              disabled={
                busy ||
                multiIds.length === 0 ||
                (multiIds.includes(OTHER_CHOICE_ID) && !otherText.trim())
              }
            >
              {idx < questions.length - 1 ? 'Далее' : 'Отправить'}
            </button>
          </form>
        ) : current?.type === 'GRID' ? (
          <form className="grid-answer" onSubmit={(e) => void submitGrid(e)}>
            <div className="matrix-scroll">
              <table className="matrix-table">
                <thead>
                  <tr>
                    <th className="matrix-corner" />
                    {gridColumns.map((col) => (
                      <th key={col.id}>{col.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {gridRows.map((row) => (
                    <tr key={row.id}>
                      <th scope="row">{row.label}</th>
                      {gridColumns.map((col) => (
                        <td key={col.id}>
                          <label className="matrix-radio">
                            <input
                              type="radio"
                              name={`grid-${current.id}-${row.id}`}
                              checked={gridDraft[row.id] === col.id}
                              disabled={busy}
                              onChange={() =>
                                setGridDraft((prev) => ({
                                  ...prev,
                                  [row.id]: col.id,
                                }))
                              }
                            />
                            <span />
                          </label>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              className="btn btn-primary"
              type="submit"
              disabled={busy || !gridComplete}
            >
              {idx < questions.length - 1 ? 'Далее' : 'Отправить'}
            </button>
          </form>
        ) : (
          <div className="scale-wrap">
            <div
              className={`scale ${scaleMax >= 10 ? 'scale-10' : ''} ${current?.type === 'ENPS' ? 'enps' : ''}`}
            >
              {options.map((n) => (
                <button
                  key={n}
                  type="button"
                  disabled={busy}
                  className={answers[current.id]?.valueInt === n ? 'active' : ''}
                  onClick={() => void choose(n)}
                >
                  {n}
                </button>
              ))}
            </div>
            <div className="scale-ends">
              <span>{minLabel}</span>
              <span>{maxLabel}</span>
            </div>
          </div>
        )}

        <div className="nav-row">
          <button
            className="btn btn-secondary"
            disabled={idx === 0 || busy}
            onClick={() => setIdx((i) => Math.max(0, i - 1))}
          >
            Назад
          </button>
        </div>
      </div>
    </div>
  );
}
