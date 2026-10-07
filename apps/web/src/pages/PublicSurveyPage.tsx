import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, ApiError } from '../api';
import { coverSrc } from '../coverPresets';
import './public-survey.css';

type Question = {
  id: string;
  text: string;
  metric?: string;
  category?: string;
  type: 'LIKERT' | 'ENPS' | 'TEXT';
};

type Payload = {
  organizationName: string;
  anonymousNotice: string;
  survey: {
    id: string;
    title: string;
    description?: string;
    coverImage?: string;
    questions: Question[];
  };
};

export function PublicSurveyPage() {
  const { token } = useParams();
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState('');
  const [started, setStarted] = useState(false);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
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

  const choose = async (value: number) => {
    if (!current || !token || !data) return;
    const nextAnswers = { ...answers, [current.id]: value };
    setAnswers(nextAnswers);
    if (idx < questions.length - 1) {
      setIdx((i) => i + 1);
      return;
    }
    setBusy(true);
    try {
      await api(`/public/surveys/${token}/submit`, {
        method: 'POST',
        body: {
          answers: Object.entries(nextAnswers).map(([questionId, valueInt]) => ({
            questionId,
            valueInt,
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

  if (error) {
    return (
      <div className="public-wrap">
        <div className="public-card">
          <h1>Опрос недоступен</h1>
          <p>{error}</p>
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
            <p>Ваши ответы сохранены. Опрос анонимный для коллег.</p>
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
            <p className="anon">{data.anonymousNotice}</p>
            <p className="muted">Вопросов: {questions.length}</p>
            <button className="btn btn-primary start-btn" onClick={() => setStarted(true)}>
              Начать опрос
            </button>
          </div>
        </div>
      </div>
    );
  }

  const max = current?.type === 'ENPS' ? 10 : 5;
  const min = current?.type === 'ENPS' ? 0 : 1;
  const options = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  const tagClass =
    current?.category === 'loyalty'
      ? 'loyalty'
      : current?.category === 'satisfaction'
        ? 'satisfaction'
        : current?.category === 'pulse'
          ? 'pulse'
          : '';

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
        <div className={`q-tag ${tagClass}`}>{current?.metric || current?.type}</div>
        <h2>{current?.text}</h2>
        <p className="hint">
          {current?.type === 'ENPS'
            ? '0 — точно нет, 10 — обязательно да'
            : '1 — совершенно не согласен, 5 — полностью согласен'}
        </p>
        <div className={`scale ${current?.type === 'ENPS' ? 'enps' : ''}`}>
          {options.map((n) => (
            <button
              key={n}
              disabled={busy}
              className={answers[current.id] === n ? 'active' : ''}
              onClick={() => void choose(n)}
            >
              {n}
            </button>
          ))}
        </div>
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
