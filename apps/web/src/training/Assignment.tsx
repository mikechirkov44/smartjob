import { useState } from "react";
import { EmailExercise } from "./LessonViewer";
import { questionTypeLabel } from "./types";
import type { Question } from "./types";
export function AssignmentView({ question: q,preview=false }: { question: Question;preview?:boolean }) {
  return !q.type || q.type === "email" ? (
    <EmailExercise question={q} />
  ) : (
    <article className="training-email">
      <div className="email-top">
        <span className="training-kicker">{questionTypeLabel(q.type)}</span>
        <h2>{q.subject}</h2>
      </div>
      <div className="email-body training-prose">{q.body}</div>
      {preview&&<ul>{q.options?.map(o=><li key={o.id}>{o.text}</li>)}</ul>}
    </article>
  );
}
export function AssignmentAnswer({
  question: q,
  busy,
  onAnswer,
}: {
  question: Question;
  busy: boolean;
  onAnswer: (choice?: boolean, selection?: string[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  if (!q.type || q.type === "email")
    return (
      <div className="training-answers">
        <button
          className="btn btn-primary"
          disabled={busy}
          onClick={() => onAnswer(true)}
        >
          Фишинг
        </button>
        <button
          className="btn btn-secondary"
          disabled={busy}
          onClick={() => onAnswer(false)}
        >
          Безопасное письмо
        </button>
      </div>
    );
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onAnswer(undefined, selected);
      }}
    >
      <fieldset disabled={busy} className="training-options">
        <legend>
          {q.type === "multi"
            ? "Выберите все правильные варианты"
            : "Выберите один ответ"}
        </legend>
        {q.options?.map((o) => (
          <label key={o.id}>
            <input
              type={q.type === "multi" ? "checkbox" : "radio"}
              name={q.id}
              value={o.id}
              checked={selected.includes(o.id)}
              onChange={(e) =>
                setSelected(
                  q.type === "multi"
                    ? e.target.checked
                      ? [...selected, o.id]
                      : selected.filter((id) => id !== o.id)
                    : [o.id],
                )
              }
            />
            <span>{o.text}</span>
          </label>
        ))}
      </fieldset>
      <button className="btn btn-primary" disabled={busy || !selected.length}>
        {busy ? "Сохраняем…" : "Ответить"}
      </button>
    </form>
  );
}
export function AssignmentEditor({
  question: q,
  onChange,
}: {
  question: Question;
  onChange: (v: Partial<Question>) => void;
}) {
  const email = !q.type || q.type === "email";
  return (
    <>
      <label>
        {email ? "Тема письма" : "Название задания"}
        <input
          maxLength={1000}
          value={q.subject}
          onChange={(e) => onChange({ subject: e.target.value })}
        />
      </label>
      {email && (
        <div className="training-fields">
          <label>
            Имя отправителя
            <input
              maxLength={1000}
              value={q.sender}
              onChange={(e) => onChange({ sender: e.target.value })}
            />
          </label>
          <label>
            Адрес отправителя
            <input
              maxLength={1000}
              value={q.address}
              onChange={(e) => onChange({ address: e.target.value })}
            />
          </label>
        </div>
      )}
      <label>
        {email
          ? "Текст письма"
          : q.type === "truefalse"
            ? "Утверждение"
            : "Вопрос или описание ситуации"}
        <textarea
          maxLength={20000}
          rows={4}
          value={q.body}
          onChange={(e) => onChange({ body: e.target.value })}
        />
      </label>
      {email ? (
        <>
          <label>
            Адрес ссылки
            <input
              maxLength={1000}
              value={q.link}
              onChange={(e) => onChange({ link: e.target.value })}
            />
          </label>
          <label>
            Правильный ответ
            <select
              value={q.phishing ? "phishing" : "safe"}
              onChange={(e) =>
                onChange({ phishing: e.target.value === "phishing" })
              }
            >
              <option value="phishing">Фишинг</option>
              <option value="safe">Безопасное письмо</option>
            </select>
          </label>
        </>
      ) : (
        <div className="stack">
          <p className="muted">
            {q.type === "multi"
              ? "Отметьте все правильные ответы. Балл начисляется за точный набор."
              : "Отметьте один правильный ответ."}
          </p>
          {q.options?.map((o) => (
            <div key={o.id} className="training-option-editor">
              <input
                aria-label={`Правильный ответ: ${o.text || "вариант"}`}
                type={q.type === "multi" ? "checkbox" : "radio"}
                name={`correct-${q.id}`}
                checked={q.correctOptionIds?.includes(o.id) || false}
                onChange={(e) =>
                  onChange({
                    correctOptionIds:
                      q.type === "multi"
                        ? e.target.checked
                          ? [...(q.correctOptionIds || []), o.id]
                          : (q.correctOptionIds || []).filter(
                              (id) => id !== o.id,
                            )
                        : [o.id],
                  })
                }
              />
              <input
                aria-label="Вариант ответа"
                maxLength={2000}
                readOnly={q.type === "truefalse"}
                value={o.text}
                onChange={(e) =>
                  onChange({
                    options: q.options!.map((v) =>
                      v.id === o.id ? { ...v, text: e.target.value } : v,
                    ),
                  })
                }
              />
              {q.type !== "truefalse" && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={q.options!.length <= 2}
                  onClick={() =>
                    onChange({
                      options: q.options!.filter((v) => v.id !== o.id),
                      correctOptionIds: q.correctOptionIds?.filter(
                        (id) => id !== o.id,
                      ),
                    })
                  }
                >
                  Удалить вариант
                </button>
              )}
            </div>
          ))}
          {q.type !== "truefalse" && (
            <button
              type="button"
              className="btn btn-secondary"
              disabled={(q.options?.length || 0) >= 10}
              onClick={() =>
                onChange({
                  options: [
                    ...(q.options || []),
                    {
                      id: `option-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                      text: "",
                    },
                  ],
                })
              }
            >
              + Вариант ответа
            </button>
          )}
        </div>
      )}
      <label>
        Объяснение после ответа
        <textarea
          maxLength={20000}
          value={q.explanation}
          onChange={(e) => onChange({ explanation: e.target.value })}
        />
      </label>
    </>
  );
}
