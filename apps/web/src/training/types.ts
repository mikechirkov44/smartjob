export type LessonBlock = {
  id: string;
  type: "text" | "image" | "video";
  text?: string;
  url?: string;
  caption?: string;
};
export type Question = {
  type?: "email" | "single" | "multi" | "situation" | "truefalse";
  options?: { id: string; text: string }[];
  correctOptionIds?: string[];
  id: string;
  subject: string;
  sender: string;
  address: string;
  body: string;
  link: string;
  phishing: boolean;
  explanation: string;
};
export type Content = {
  title: string;
  description: string;
  passMark: number;
  blocks: LessonBlock[];
  questions: Question[];
  reminder: string;
};
export type Course = {
  id: string;
  title: string;
  status: string;
  token: string;
  publishedVersion: number;
  updatedAt: string;
  draft: Content;
};
export type Feedback = {
  questionId: string;
  choice?: boolean;
  selection?: string[];
  correctOptionIds?: string[];
  correctLabels?: string[];
  correct: boolean;
  phishing: boolean;
  explanation: string;
};
export type Score = {
  score: number;
  passed: boolean;
  correct: number;
  total: number;
};
export type Attempt = {
  token: string;
  participantName: string;
  version: number;
  content: Content;
  answers: Feedback[];
  completedAt: string | null;
  result: Score | null;
};
export const statusText = (s: string) =>
  ({ DRAFT: "Черновик", ACTIVE: "Опубликован", CLOSED: "Закрыт" })[s] || s;
export const errorText = (e: unknown) =>
  e instanceof Error ? e.message : "Не удалось выполнить действие";

export const questionTypeLabel = (type?: Question["type"]) =>
  ({
    email: "Письмо",
    single: "Один правильный ответ",
    multi: "Несколько правильных ответов",
    situation: "Рабочая ситуация",
    truefalse: "Верно / Неверно",
  })[type || "email"];
export function answerLabel(
  q: Question,
  choice?: boolean,
  selection?: string[],
) {
  return !q.type || q.type === "email"
    ? choice
      ? "Фишинг"
      : "Безопасное письмо"
    : (q.options || [])
        .filter((o) => selection?.includes(o.id))
        .map((o) => o.text)
        .join("; ");
}
export function blankQuestion(type: NonNullable<Question["type"]>): Question {
  return {
    id: `q-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    type,
    subject: "",
    body: "",
    sender: "",
    address: "",
    link: "",
    phishing: true,
    explanation: "",
    ...(type === "email"
      ? {}
      : {
          options:
            type === "truefalse"
              ? [
                  { id: "true", text: "Верно" },
                  { id: "false", text: "Неверно" },
                ]
              : [
                  { id: "a", text: "" },
                  { id: "b", text: "" },
                ],
          correctOptionIds: [],
        }),
  };
}
