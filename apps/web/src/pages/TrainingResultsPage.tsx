import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { errorText } from "../training/types";
import type { Content } from "../training/types";
import "../training/training.css";
type Item = {
  id: string;
  participantName: string;
  createdAt: string;
  completedAt: string | null;
  score: number | null;
  passed: boolean | null;
  revision: { version: number; content: Content };
  answers: { questionId: string; choice: boolean; correct: boolean }[];
};
export function TrainingResultsPage() {
  const { id } = useParams();
  const { token, organizationId } = useAuth();
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ items: Item[]; total: number } | null>(
    null,
  );
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    setPage(1);
  }, [id, organizationId]);
  useEffect(() => {
    let live = true;
    setData(null);
    setError("");
    if (organizationId)
      api<{ items: Item[]; total: number }>(
        `/organizations/${organizationId}/training/${id}/attempts?page=${page}`,
        { token, organizationId },
      )
        .then((d) => {
          if (live) setData(d);
        })
        .catch((e) => {
          if (live) setError(errorText(e));
        });
    return () => {
      live = false;
    };
  }, [id, organizationId, page, token, refresh]);
  return (
    <div className="stack training-page">
      <div className="training-header">
        <div>
          <Link to="/training">← Обучение</Link>
          <h1 className="page-title">Результаты обучения</h1>
          <p className="page-sub">
            Каждая попытка сохраняется отдельно. Имя указывает сам участник.
          </p>
        </div>
        <button
          className="btn btn-secondary"
          onClick={() => setRefresh((v) => v + 1)}
        >
          Обновить
        </button>
      </div>
      {error && (
        <div className="training-error" role="alert">
          {error}
        </div>
      )}
      {!data ? (
        <div className="card training-empty">
          {error ? "Не удалось загрузить результаты." : "Загрузка…"}
        </div>
      ) : (
        <>
          <p>
            Всего попыток: <strong>{data.total}</strong>
          </p>
          <div className="card training-table-wrap">
            <table className="training-table">
              <thead>
                <tr>
                  <th>Участник</th>
                  <th>Начало</th>
                  <th>Версия</th>
                  <th>Результат</th>
                  <th>Ответы</th>
                </tr>
              </thead>
              <tbody>
                {!data.items.length && (
                  <tr>
                    <td colSpan={5}>
                      Пока нет прохождений. Отправьте сотрудникам ссылку на
                      опубликованный курс.
                    </td>
                  </tr>
                )}
                {data.items.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <strong>{a.participantName}</strong>
                    </td>
                    <td>
                      {new Date(a.createdAt).toLocaleString("ru-RU")}
                      {a.completedAt && (
                        <div className="muted">
                          Завершено:{" "}
                          {new Date(a.completedAt).toLocaleString("ru-RU")}
                        </div>
                      )}
                    </td>
                    <td>{a.revision.version}</td>
                    <td>
                      {a.completedAt ? (
                        <>
                          <strong>{a.score}%</strong>
                          <div>{a.passed ? "Пройден" : "Не пройден"}</div>
                        </>
                      ) : (
                        "Не завершено"
                      )}
                    </td>
                    <td>
                      <details>
                        <summary>
                          Ответов: {a.answers.length} /{" "}
                          {a.revision.content.questions.length}
                        </summary>
                        {a.revision.content.questions.map((q, i) => {
                          const v = a.answers.find(
                            (v) => v.questionId === q.id,
                          );
                          return (
                            <div key={q.id} className="training-result-details">
                              <strong>
                                {i + 1}. {q.subject}
                              </strong>
                              <p>
                                {v
                                  ? `Ответ: ${v.choice ? "Фишинг" : "Безопасное письмо"} · ${v.correct ? "верно" : "ошибка"}`
                                  : "Нет ответа"}
                              </p>
                              <p>
                                Правильно:{" "}
                                {q.phishing ? "Фишинг" : "Безопасное письмо"}
                              </p>
                              <p>{q.explanation}</p>
                            </div>
                          );
                        })}
                      </details>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="training-actions">
            <button
              className="btn btn-secondary"
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              ← Назад
            </button>
            <span>Страница {page}</span>
            <button
              className="btn btn-secondary"
              disabled={page * 20 >= data.total}
              onClick={() => setPage((p) => p + 1)}
            >
              Далее →
            </button>
          </div>
        </>
      )}
    </div>
  );
}
