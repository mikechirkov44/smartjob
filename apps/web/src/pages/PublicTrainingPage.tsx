import { forgetAttempt } from "../training/editor-state";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../api";
import { LessonViewer, EmailExercise } from "../training/LessonViewer";
import { errorText } from "../training/types";
import type { Attempt, Feedback, Score } from "../training/types";
import "../training/training.css";
type Overview = {
  title: string;
  description: string;
  questionCount: number;
  version: number;
};
export function PublicTrainingPage() {
  const { linkToken = "" } = useParams();
  const key = `smartjob-training:${linkToken}`;
  const [overview, setOverview] = useState<Overview | null>(null);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [name, setName] = useState("");
  const [stage, setStage] = useState<"name" | "lesson" | "quiz" | "result">(
    "name",
  );
  const [index, setIndex] = useState(0);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fatal, setFatal] = useState(false);
  useEffect(() => {
    let live = true;
    setLoading(true);
    setAttempt(null);
    setOverview(null);
    setError("");
    setFatal(false);
    setStage("name");
    async function load() {
      try {
        const o = await api<Overview>(`/public/training/${linkToken}`);
        if (!live) return;
        setOverview(o);
        let saved: string | null = null;
        try {
          saved = localStorage.getItem(key);
        } catch {
          /* storage can be unavailable */
        }
        if (saved) {
          try {
            const a = await api<Attempt>(`/public/training/attempts/${saved}`);
            if (live) {
              setAttempt(a);
              setName(a.participantName);
              setIndex(Math.max(0, a.answers.length - 1));
              setStage(
                a.completedAt ? "result" : a.answers.length ? "quiz" : "lesson",
              );
            }
          } catch (e) {
            if (!forgetAttempt(e)) throw e;
            try {
              localStorage.removeItem(key);
            } catch {
              /* noop */
            }
          }
        }
      } catch (e) {
        if (live) {
          setError(errorText(e));
          setFatal(true);
        }
      } finally {
        if (live) setLoading(false);
      }
    }
    void load();
    return () => {
      live = false;
    };
  }, [key, linkToken]);
  async function start() {
    setBusy(true);
    setError("");
    try {
      const s = await api<{ token: string }>(
        `/public/training/${linkToken}/start`,
        { body: { participantName: name } },
      );
      try {
        localStorage.setItem(key, s.token);
      } catch {
        /* allow proceeding without persistence */
      }
      const a = await api<Attempt>(`/public/training/attempts/${s.token}`);
      setAttempt(a);
      setStage("lesson");
      setIndex(0);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function answer(choice: boolean) {
    if (!attempt) return;
    setBusy(true);
    setError("");
    try {
      const f = await api<Feedback>(
        `/public/training/attempts/${attempt.token}/answers`,
        { body: { questionId: attempt.content.questions[index].id, choice } },
      );
      setAttempt((a) =>
        a
          ? {
              ...a,
              answers: [
                ...a.answers.filter((v) => v.questionId !== f.questionId),
                f,
              ],
            }
          : a,
      );
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function finish() {
    if (!attempt) return;
    setBusy(true);
    setError("");
    try {
      const result = await api<Score>(
        `/public/training/attempts/${attempt.token}/complete`,
        { method: "POST" },
      );
      setAttempt((a) =>
        a ? { ...a, result, completedAt: new Date().toISOString() } : a,
      );
      setStage("result");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  const c = attempt?.content;
  const q = c?.questions[index];
  const f = attempt?.answers.find((a) => a.questionId === q?.id);
  return (
    <main className="training-public">
      <span className="training-kicker">SmartJob · Обучение</span>
      {loading ? (
        <div className="card">Загрузка курса…</div>
      ) : (
        <>
          <div className="card">
            <h1>{c?.title || overview?.title || "Курс недоступен"}</h1>
            {stage === "name" && overview && !fatal && (
              <>
                <p className="training-prose">{overview.description}</p>
                <div className="training-notice">
                  {overview.questionCount} заданий · разбор после каждого ответа
                  <br />
                  Без регистрации. Результат будет виден администратору под
                  указанным вами именем.
                </div>
                <form
                  className="training-form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void start();
                  }}
                >
                  <label>
                    Имя и фамилия
                    <input
                      autoComplete="name"
                      required
                      minLength={3}
                      maxLength={160}
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Например, Иван Петров"
                    />
                  </label>
                  <button
                    className="btn btn-primary"
                    disabled={busy || name.trim().length < 3}
                  >
                    {busy ? "Подождите…" : "Начать обучение"}
                  </button>
                </form>
              </>
            )}
            {attempt && (
              <p className="muted">
                {attempt.participantName} · версия {attempt.version}
              </p>
            )}
            {stage === "lesson" && c && (
              <>
                <div className="training-notice">
                  Сначала изучите материал, затем проверьте себя на примерах
                  писем.
                </div>
                <LessonViewer blocks={c.blocks} />
                <button
                  className="btn btn-primary"
                  style={{ marginTop: 28 }}
                  onClick={() => {
                    setStage("quiz");
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                >
                  Перейти к практике →
                </button>
              </>
            )}
            {stage === "quiz" && q && c && (
              <>
                <div className="training-progress">
                  <span className="muted">
                    Задание {index + 1} из {c.questions.length}
                  </span>
                  <progress
                    value={index + (f ? 1 : 0)}
                    max={c.questions.length}
                  />
                </div>
                <EmailExercise key={q.id} question={q} />
                {!f ? (
                  <>
                    <p style={{ marginTop: 20 }}>Как вы оцените это письмо?</p>
                    <div className="training-answers">
                      <button
                        className="btn btn-primary"
                        disabled={busy}
                        onClick={() => void answer(true)}
                      >
                        Фишинг
                      </button>
                      <button
                        className="btn btn-secondary"
                        disabled={busy}
                        onClick={() => void answer(false)}
                      >
                        Безопасное письмо
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div
                      className={`training-feedback ${f.correct ? "" : "wrong"}`}
                      role="status"
                    >
                      <strong>
                        {f.correct ? "Верно!" : "Разберём этот пример"}
                      </strong>
                      <p>
                        Правильный ответ:{" "}
                        <strong>
                          {f.phishing ? "Фишинг" : "Безопасное письмо"}
                        </strong>
                      </p>
                      <p className="training-prose">{f.explanation}</p>
                    </div>
                    {index < c.questions.length - 1 ? (
                      <button
                        className="btn btn-primary"
                        onClick={() => {
                          setIndex((i) => i + 1);
                          window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                      >
                        Следующее письмо →
                      </button>
                    ) : (
                      <button
                        className="btn btn-primary"
                        disabled={busy}
                        onClick={() => void finish()}
                      >
                        {busy
                          ? "Сохраняем результат…"
                          : "Завершить и увидеть результат"}
                      </button>
                    )}
                  </>
                )}
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ marginTop: 18 }}
                  onClick={() => setStage("lesson")}
                >
                  Вернуться к материалам
                </button>
              </>
            )}
            {stage === "result" && attempt?.result && c && (
              <>
                <div className="training-score">{attempt.result.score}%</div>
                <h2>
                  {attempt.result.passed
                    ? "Курс пройден"
                    : "Стоит потренироваться ещё"}
                </h2>
                <p>
                  Верных ответов: {attempt.result.correct} из{" "}
                  {attempt.result.total}. Проходной балл: {c.passMark}%.
                </p>
                <p className="muted">
                  Именной результат сохранён и доступен администратору.
                </p>
                <div className="training-notice">
                  <strong>Памятка</strong>
                  <p className="training-prose">{c.reminder}</p>
                </div>
                <details>
                  <summary>Посмотреть разбор заданий</summary>
                  {c.questions.map((question, i) => {
                    const feedback = attempt.answers.find(
                      (a) => a.questionId === question.id,
                    );
                    return (
                      <div
                        className="training-result-details"
                        key={question.id}
                      >
                        <strong>
                          {i + 1}. {question.subject} —{" "}
                          {feedback?.correct ? "верно" : "ошибка"}
                        </strong>
                        <p>
                          Правильный ответ:{" "}
                          {feedback?.phishing ? "Фишинг" : "Безопасное письмо"}
                        </p>
                        <p className="training-prose">
                          {feedback?.explanation}
                        </p>
                      </div>
                    );
                  })}
                </details>
                <button
                  className="btn btn-secondary"
                  style={{ marginTop: 24 }}
                  onClick={() => {
                    try {
                      localStorage.removeItem(key);
                    } catch {
                      /* noop */
                    }
                    setAttempt(null);
                    setStage("name");
                    setError("");
                  }}
                >
                  Пройти ещё раз
                </button>
              </>
            )}
            {error && (
              <div
                className="training-error"
                role="alert"
                style={{ marginTop: 18 }}
              >
                {error}
              </div>
            )}
          </div>
          <p
            className="muted"
            style={{ textAlign: "center", fontSize: 12, marginTop: 20 }}
          >
            Учебные примеры. Не вводите реальные пароли и не переходите по
            адресам из писем.
          </p>
        </>
      )}
    </main>
  );
}
