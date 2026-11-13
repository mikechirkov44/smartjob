import { preserveNewerEdits } from "../training/editor-state";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams, useBlocker } from "react-router-dom";
import { api, uploadFile } from "../api";
import { useAuth } from "../auth";
import type { Content, Course, LessonBlock, Question } from "../training/types";
import { errorText, statusText } from "../training/types";
import { LessonViewer, EmailExercise } from "../training/LessonViewer";
import "../training/training.css";
export function TrainingEditPage() {
  const { id } = useParams();
  const { token, organizationId, user } = useAuth();
  const navigate = useNavigate();
  const [course, setCourse] = useState<Course | null>(null);
  const [content, setContent] = useState<Content | null>(null);
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [preview, setPreview] = useState(false);
  const canEdit =
    user?.globalRole === "SUPER_ADMIN" ||
    user?.organizations.some(
      (o) => o.id === organizationId && o.role !== "VIEWER",
    );
  const dirty = !!content && JSON.stringify(content) !== saved;
  useEffect(() => {
    let live = true;
    setContent(null);
    setCourse(null);
    setError("");
    if (!organizationId) return;
    api<Course>(`/organizations/${organizationId}/training/${id}`, {
      token,
      organizationId,
    })
      .then((c) => {
        if (live) {
          setCourse(c);
          setContent(c.draft);
          setSaved(JSON.stringify(c.draft));
        }
      })
      .catch((e) => {
        if (live) setError(errorText(e));
      });
    return () => {
      live = false;
    };
  }, [id, organizationId, token]);
  const blocker = useBlocker(dirty);
  useEffect(() => {
    if (blocker.state === "blocked") {
      if (window.confirm("Есть несохранённые изменения. Уйти со страницы?"))
        blocker.proceed();
      else blocker.reset();
    }
  }, [blocker]);
  useEffect(() => {
    if (!dirty) return;
    const unload = (e: BeforeUnloadEvent) => e.preventDefault();
    const orgChange = (e: Event) => {
      if (!window.confirm("Есть несохранённые изменения. Сменить компанию?"))
        e.preventDefault();
    };
    window.addEventListener("beforeunload", unload);
    window.addEventListener("smartjob-before-org-change", orgChange);
    return () => {
      window.removeEventListener("beforeunload", unload);
      window.removeEventListener("smartjob-before-org-change", orgChange);
    };
  }, [dirty]);
  const path = `/organizations/${organizationId}/training/${id}`;
  function change(v: Partial<Content>) {
    setContent((c) => (c ? { ...c, ...v } : c));
    setNotice("");
  }
  function block(bid: string, v: Partial<LessonBlock>) {
    setContent((c) =>
      c
        ? {
            ...c,
            blocks: c.blocks.map((b) => (b.id === bid ? { ...b, ...v } : b)),
          }
        : c,
    );
    setNotice("");
  }
  function question(qid: string, v: Partial<Question>) {
    setContent((c) =>
      c
        ? {
            ...c,
            questions: c.questions.map((q) =>
              q.id === qid ? { ...q, ...v } : q,
            ),
          }
        : c,
    );
    setNotice("");
  }
  function move(kind: "blocks" | "questions", index: number, delta: number) {
    if (!content) return;
    const list = [...content[kind]];
    [list[index], list[index + delta]] = [list[index + delta], list[index]];
    change({ [kind]: list } as Partial<Content>);
  }
  function remove(kind: "blocks" | "questions", index: number) {
    if (content && window.confirm("Удалить этот блок?"))
      change({
        [kind]: content[kind].filter((_, i) => i !== index),
      } as Partial<Content>);
  }
  async function save() {
    if (!content) return;
    const c = await api<Course>(path, {
      method: "PATCH",
      body: { content },
      token,
      organizationId,
    });
    setCourse(c);
    setContent((current) => preserveNewerEdits(current, content, c.draft));
    setSaved(JSON.stringify(c.draft));
    return c;
  }
  async function action(kind: "save" | "publish" | "close" | "duplicate") {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (kind === "save") {
        await save();
        setNotice("Черновик сохранён.");
      } else if (kind === "publish") {
        const savedCourse = await save();
        const c = await api<Course>(path + "/publish", {
          body: { draftVersion: savedCourse!.updatedAt },
          method: "POST",
          token,
          organizationId,
        });
        setCourse(c);
        setNotice(
          `Опубликована версия ${c.publishedVersion}. Ссылка готова к отправке.`,
        );
      } else if (kind === "close") {
        if (
          !window.confirm(
            "Закрыть курс? Новые и незавершённые прохождения станут недоступны.",
          )
        )
          return;
        const c = await api<Course>(path + "/close", {
          method: "POST",
          token,
          organizationId,
        });
        setCourse(c);
        setNotice("Доступ к курсу закрыт. Результаты сохранены.");
      } else {
        await save();
        const c = await api<Course>(path + "/duplicate", {
          method: "POST",
          token,
          organizationId,
        });
        navigate(`/training/${c.id}/edit`);
      }
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  async function upload(bid: string, file?: File) {
    if (!file) return;
    setUploading(bid);
    setError("");
    try {
      const data = await uploadFile<{ url: string; kind: "image" | "video" }>(
        `/organizations/${organizationId}/training/media`,
        file,
        { token, organizationId },
      );
      block(bid, { url: data.url, type: data.kind });
      setNotice("Файл загружен. Сохраните изменения курса.");
    } catch (e) {
      setError(errorText(e));
    } finally {
      setUploading(null);
    }
  }
  const tools = (kind: "blocks" | "questions", i: number, length: number) => (
    <div className="training-actions">
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        aria-label="Переместить выше"
        disabled={i === 0}
        onClick={() => move(kind, i, -1)}
      >
        ↑
      </button>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        aria-label="Переместить ниже"
        disabled={i === length - 1}
        onClick={() => move(kind, i, 1)}
      >
        ↓
      </button>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={() => remove(kind, i)}
      >
        Удалить
      </button>
    </div>
  );
  if (!content || !course)
    return (
      <div className="card training-section">{error || "Загрузка курса…"}</div>
    );
  if (!canEdit)
    return (
      <div className="card training-section">
        Редактирование доступно сотрудникам с правами HR и выше.
      </div>
    );
  return (
    <div className="stack training-page">
      <div className="training-header">
        <div>
          <Link to="/training">← Обучение</Link>
          <h1 className="page-title">Редактор курса</h1>
          <span className="badge">{statusText(course.status)}</span>{" "}
          <span className="muted">
            Опубликованная версия: {course.publishedVersion || "нет"}
          </span>
        </div>
        <Link className="btn btn-secondary" to={`/training/${id}/results`}>
          Результаты
        </Link>
      </div>
      <div className="training-toolbar">
        <span>
          {dirty ? "Есть несохранённые изменения" : "Все изменения сохранены"}
        </span>
        <div className="training-actions">
          <button
            className="btn btn-secondary"
            onClick={() => setPreview(!preview)}
          >
            {preview ? "Вернуться к редактору" : "Предпросмотр"}
          </button>
          <button
            className="btn btn-secondary"
            disabled={busy || !!uploading}
            onClick={() => void action("save")}
          >
            Сохранить
          </button>
          <button
            className="btn btn-primary"
            disabled={busy || !!uploading}
            onClick={() => void action("publish")}
          >
            {busy ? "Подождите…" : "Опубликовать"}
          </button>
        </div>
      </div>
      {error && (
        <div role="alert" className="training-error">
          {error}
        </div>
      )}
      {notice && (
        <div role="status" className="training-success">
          {notice}
        </div>
      )}
      {course.status === "ACTIVE" && (
        <div className="training-notice">
          <strong>Ссылка для сотрудников</strong>
          <div className="training-actions" style={{ marginTop: 8 }}>
            <input
              className="input"
              aria-label="Ссылка на курс"
              readOnly
              value={`${window.location.origin}/learn/${course.token}`}
              onFocus={(e) => e.target.select()}
            />
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => {
                if (!navigator.clipboard) {
                  setNotice("Выделите и скопируйте ссылку из поля.");
                  return;
                }
                void navigator.clipboard
                  .writeText(`${window.location.origin}/learn/${course.token}`)
                  .then(() => setNotice("Ссылка скопирована."))
                  .catch(() =>
                    setNotice("Выделите и скопируйте ссылку из поля."),
                  );
              }}
            >
              Копировать
            </button>
            <a href={`/learn/${course.token}`} target="_blank" rel="noreferrer">
              Открыть
            </a>
          </div>
        </div>
      )}
      {preview ? (
        <section className="training-preview">
          <span className="training-kicker">
            Предпросмотр черновика · результат не сохраняется
          </span>
          <h2>{content.title}</h2>
          <p>{content.description}</p>
          <LessonViewer blocks={content.blocks} />
          <h2>Практические задания</h2>
          {content.questions.map((q, i) => (
            <div key={q.id} style={{ marginTop: 24 }}>
              <p>Задание {i + 1}</p>
              <EmailExercise question={q} />
              <div className="training-feedback">
                <strong>{q.phishing ? "Фишинг" : "Безопасное письмо"}</strong>
                <p>{q.explanation}</p>
              </div>
            </div>
          ))}
          <h2>Памятка</h2>
          <p className="training-prose">{content.reminder}</p>
        </section>
      ) : (
        <>
          <section className="card training-section training-form">
            <h2>О курсе</h2>
            <label>
              Название
              <input
                maxLength={200}
                value={content.title}
                onChange={(e) => change({ title: e.target.value })}
              />
            </label>
            <label>
              Краткое описание
              <textarea
                maxLength={2000}
                value={content.description}
                onChange={(e) => change({ description: e.target.value })}
              />
            </label>
            <label>
              Проходной балл, %
              <input
                type="number"
                min={1}
                max={100}
                value={content.passMark}
                onChange={(e) => change({ passMark: Number(e.target.value) })}
              />
            </label>
          </section>
          <section className="card training-section training-form">
            <h2>Обучение перед тестом</h2>
            <p className="muted">
              Добавьте объяснение, иллюстрации и видео. Блоки показываются
              сотруднику в указанном порядке.
            </p>
            {content.blocks.map((b, i) => (
              <div className="training-editor-block" key={b.id}>
                <div className="training-block-head">
                  <strong>
                    {i + 1}.{" "}
                    {b.type === "text"
                      ? "Текст"
                      : b.type === "image"
                        ? "Изображение"
                        : "Видео"}
                  </strong>
                  {tools("blocks", i, content.blocks.length)}
                </div>
                {b.type === "text" ? (
                  <label>
                    Учебный материал
                    <textarea
                      rows={7}
                      maxLength={20000}
                      value={b.text || ""}
                      onChange={(e) => block(b.id, { text: e.target.value })}
                    />
                  </label>
                ) : (
                  <>
                    <label className="training-upload">
                      {uploading === b.id
                        ? "Идёт загрузка…"
                        : b.url
                          ? "Заменить файл"
                          : "Загрузить файл"}
                      <input
                        type="file"
                        disabled={!!uploading}
                        accept={
                          b.type === "image"
                            ? "image/png,image/jpeg,image/webp"
                            : "video/mp4,video/webm"
                        }
                        onChange={(e) => void upload(b.id, e.target.files?.[0])}
                      />
                      <small>
                        {b.type === "image"
                          ? "JPG, PNG, WEBP — до 5 МБ"
                          : "MP4, WebM — до 50 МБ"}
                      </small>
                    </label>
                    {b.url &&
                      (b.type === "image" ? (
                        <img
                          src={b.url}
                          alt={b.caption || "Изображение курса"}
                        />
                      ) : (
                        <video controls preload="metadata" src={b.url} />
                      ))}
                    <label>
                      Подпись
                      <input
                        maxLength={1000}
                        value={b.caption || ""}
                        onChange={(e) =>
                          block(b.id, { caption: e.target.value })
                        }
                      />
                    </label>
                  </>
                )}
              </div>
            ))}
            <div className="training-actions">
              {(["text", "image", "video"] as const).map((type) => (
                <button
                  className="btn btn-secondary"
                  key={type}
                  onClick={() =>
                    change({
                      blocks: [
                        ...content.blocks,
                        {
                          id: `block-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                          type,
                          ...(type === "text" ? { text: "" } : { caption: "" }),
                        },
                      ],
                    })
                  }
                >
                  +{" "}
                  {type === "text"
                    ? "Текст"
                    : type === "image"
                      ? "Фото"
                      : "Видео"}
                </button>
              ))}
            </div>
          </section>
          <section className="card training-section training-form">
            <h2>Практика: письма</h2>
            <p className="muted">
              Разбор показывается сразу после ответа. Адреса в примерах не
              открываются как ссылки.
            </p>
            {content.questions.map((q, i) => (
              <div className="training-editor-block" key={q.id}>
                <div className="training-block-head">
                  <strong>Задание {i + 1}</strong>
                  {tools("questions", i, content.questions.length)}
                </div>
                <label>
                  Тема письма
                  <input
                    maxLength={1000}
                    value={q.subject}
                    onChange={(e) =>
                      question(q.id, { subject: e.target.value })
                    }
                  />
                </label>
                <div className="training-fields">
                  <label>
                    Имя отправителя
                    <input
                      maxLength={1000}
                      value={q.sender}
                      onChange={(e) =>
                        question(q.id, { sender: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    Адрес отправителя
                    <input
                      maxLength={1000}
                      value={q.address}
                      onChange={(e) =>
                        question(q.id, { address: e.target.value })
                      }
                    />
                  </label>
                </div>
                <label>
                  Текст письма
                  <textarea
                    rows={4}
                    maxLength={20000}
                    value={q.body}
                    onChange={(e) => question(q.id, { body: e.target.value })}
                  />
                </label>
                <label>
                  Адрес ссылки в письме
                  <input
                    maxLength={1000}
                    value={q.link}
                    onChange={(e) => question(q.id, { link: e.target.value })}
                  />
                </label>
                <label>
                  Правильный ответ
                  <select
                    value={q.phishing ? "phishing" : "safe"}
                    onChange={(e) =>
                      question(q.id, {
                        phishing: e.target.value === "phishing",
                      })
                    }
                  >
                    <option value="phishing">Фишинг</option>
                    <option value="safe">Безопасное письмо</option>
                  </select>
                </label>
                <label>
                  Объяснение после ответа
                  <textarea
                    maxLength={20000}
                    value={q.explanation}
                    onChange={(e) =>
                      question(q.id, { explanation: e.target.value })
                    }
                  />
                </label>
              </div>
            ))}
            <button
              className="btn btn-secondary"
              onClick={() =>
                change({
                  questions: [
                    ...content.questions,
                    {
                      id: `block-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                      subject: "",
                      sender: "",
                      address: "",
                      body: "",
                      link: "",
                      phishing: true,
                      explanation: "",
                    },
                  ],
                })
              }
            >
              + Добавить задание
            </button>
          </section>
          <section className="card training-section training-form">
            <h2>Памятка после курса</h2>
            <textarea
              aria-label="Итоговая памятка"
              rows={5}
              maxLength={20000}
              value={content.reminder}
              onChange={(e) => change({ reminder: e.target.value })}
            />
          </section>
        </>
      )}
      <div className="training-notice">
        Редактирование меняет черновик. Сотрудники увидят новую версию после
        публикации. Начатые попытки и старые результаты останутся привязаны к
        своей версии.
      </div>
      <div className="training-actions">
        <button
          className="btn btn-secondary"
          disabled={busy || !!uploading}
          onClick={() => void action("duplicate")}
        >
          Создать копию
        </button>
        {course.status === "ACTIVE" && (
          <button
            className="btn btn-secondary"
            disabled={busy}
            onClick={() => void action("close")}
          >
            Закрыть доступ
          </button>
        )}
      </div>
    </div>
  );
}
