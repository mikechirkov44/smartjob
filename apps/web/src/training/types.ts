export type LessonBlock = {
  id: string;
  type: "text" | "image" | "video";
  text?: string;
  url?: string;
  caption?: string;
};
export type Question = {
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
  choice: boolean;
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
