import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth";
import { errorText, statusText } from "../training/types";
import type { Course } from "../training/types";
import "../training/training.css";
export function TrainingListPage() {
  const { token, organizationId, user } = useAuth();
  const navigate = useNavigate();
  const [items, setItems] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const canEdit =
    user?.globalRole === "SUPER_ADMIN" ||
    user?.organizations.some(
      (o) => o.id === organizationId && o.role !== "VIEWER",
    );
  useEffect(() => {
    let live = true;
    setItems([]);
    setError("");
    setLoading(true);
    if (!organizationId) {
      setLoading(false);
      return;
    }
    api<Course[]>(`/organizations/${organizationId}/training`, {
      token,
      organizationId,
    })
      .then((v) => {
        if (live) setItems(v);
      })
      .catch((e) => {
        if (live) setError(errorText(e));
      })
      .finally(() => {
        if (live) setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [organizationId, token]);
  async function create(template: string) {
    setBusy(true);
    setError("");
    try {
      const c = await api<Course>(`/organizations/${organizationId}/training`, {
        token,
        organizationId,
        body: { template },
      });
      navigate(`/training/${c.id}/edit`);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  if (!organizationId)
    return (
      <div className="card training-empty">
        Выберите компанию для управления обучением.
      </div>
    );
  return (
    <div className="stack training-page page-enter">
      <div className="training-header">
        <div>
          <span className="training-kicker">Знания, которые защищают</span>
          <h1 className="page-title">Обучение</h1>
          <p className="page-sub">
            Короткие курсы, практика и именные результаты.
          </p>
        </div>
        {canEdit && (
          <div className="training-actions">
            <button
              className="btn btn-secondary"
              disabled={busy}
              onClick={() => void create("blank")}
            >
              Создать курс
            </button>
          </div>
        )}
      </div>
      {error && (
        <div role="alert" className="training-error">
          {error}
        </div>
      )}
      {loading ? (
        <div className="card training-empty">Загрузка курсов…</div>
      ) : !items.length ? (
        <div className="card training-empty">
          <h2>Создайте первый курс</h2>
          <p>
            Добавьте учебные материалы и задания под
            вашу компанию.
          </p>
        </div>
      ) : (
        <div className="training-grid">
          {items.map((c) => (
            <article className="card training-course" key={c.id}>
              <div className="training-actions">
                <span className="badge">{statusText(c.status)}</span>
                {c.publishedVersion > 0 && (
                  <span className="muted">Версия {c.publishedVersion}</span>
                )}
              </div>
              <h2>{c.title}</h2>
              <p>Прохождение по ссылке · без регистрации</p>
              <div className="training-actions">
                {canEdit && (
                  <Link
                    className="btn btn-primary btn-sm"
                    to={`/training/${c.id}/edit`}
                  >
                    Редактировать
                  </Link>
                )}
                <Link
                  className="btn btn-secondary btn-sm"
                  to={`/training/${c.id}/results`}
                >
                  Результаты
                </Link>
                {c.status === "ACTIVE" && (
                  <a
                    className="btn btn-secondary btn-sm"
                    href={`/learn/${c.token}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Открыть курс
                  </a>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
