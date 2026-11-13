import type { LessonBlock, Question } from "./types";
export function LessonViewer({ blocks }: { blocks: LessonBlock[] }) {
  return (
    <div className="lesson-blocks">
      {blocks.map((b) => (
        <section key={b.id} className="lesson-block">
          {b.type === "text" ? (
            <p className="training-prose">{b.text}</p>
          ) : b.url ? (
            <figure>
              {b.type === "image" ? (
                <img
                  src={b.url}
                  alt={b.caption || "Учебная иллюстрация"}
                  loading="lazy"
                />
              ) : (
                <video
                  controls
                  preload="metadata"
                  src={b.url}
                  aria-label={b.caption || "Учебное видео"}
                  onError={(e) => {
                    e.currentTarget.insertAdjacentText(
                      "afterend",
                      "Видео недоступно. Попробуйте обновить страницу.",
                    );
                  }}
                />
              )}
              {b.caption && <figcaption>{b.caption}</figcaption>}
            </figure>
          ) : (
            <p className="muted">Материал ещё не загружен</p>
          )}
        </section>
      ))}
    </div>
  );
}
export function EmailExercise({ question: q }: { question: Question }) {
  return (
    <article className="training-email">
      <div className="email-top">
        <span className="training-kicker">Учебное письмо</span>
        <h2>{q.subject}</h2>
        <div>
          <strong>От:</strong> {q.sender}
        </div>
        <details>
          <summary>Проверить полный адрес отправителя</summary>
          <code>{q.address}</code>
        </details>
      </div>
      <div className="email-body training-prose">{q.body}</div>
      {q.link && (
        <div className="email-link">
          <strong>Адрес ссылки — только для проверки</strong>
          <code>{q.link}</code>
          <small>В учебном письме ссылка не открывается.</small>
        </div>
      )}
    </article>
  );
}
