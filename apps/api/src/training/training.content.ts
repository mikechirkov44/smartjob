import { BadRequestException } from '@nestjs/common';
export type LessonBlock = {
  id: string;
  type: 'text' | 'image' | 'video';
  text?: string;
  url?: string;
  caption?: string;
};
export type TrainingQuestion = {
  id: string;
  subject: string;
  sender: string;
  address: string;
  body: string;
  link: string;
  phishing: boolean;
  explanation: string;
};
export type TrainingContent = {
  title: string;
  description: string;
  passMark: number;
  blocks: LessonBlock[];
  questions: TrainingQuestion[];
  reminder: string;
};
const fail = () => {
  throw new BadRequestException(
    'Проверьте содержание курса: текст, материалы и задания',
  );
};
function text(v: unknown, max = 20000): v is string {
  return typeof v === 'string' && v.length <= max;
}
export function validateContent(
  value: unknown,
  publish = true,
): TrainingContent {
  if (Buffer.byteLength(JSON.stringify(value) || '', 'utf8') > 900000)
    throw new BadRequestException(
      'Содержимое курса больше 900 КБ. Сократите текст.',
    );
  const c = value as TrainingContent;
  if (
    !c ||
    !text(c.title, 200) ||
    !c.title.trim() ||
    !text(c.description, 2000) ||
    !text(c.reminder) ||
    !Number.isInteger(c.passMark) ||
    c.passMark < 1 ||
    c.passMark > 100 ||
    !Array.isArray(c.blocks) ||
    c.blocks.length > 100 ||
    !Array.isArray(c.questions) ||
    c.questions.length > 100
  )
    return fail();
  const ids = new Set<string>();
  for (const b of c.blocks) {
    if (!b || !text(b.id, 100) || !b.id || ids.has(b.id)) return fail();
    ids.add(b.id);
    if (b.caption !== undefined && !text(b.caption, 1000)) return fail();
    if (b.type === 'text') {
      if (!text(b.text)) return fail();
    } else if (b.type === 'image' || b.type === 'video') {
      if (
        b.url &&
        !/^\/api\/training-media\/[a-f0-9-]{36}\.(png|jpg|webp|mp4|webm)$/.test(
          b.url,
        )
      )
        return fail();
      if (publish && !b.url) return fail();
    } else return fail();
  }
  ids.clear();
  for (const q of c.questions) {
    if (!q || !text(q.id, 100) || !q.id || ids.has(q.id)) return fail();
    ids.add(q.id);
    for (const k of [
      'subject',
      'sender',
      'address',
      'body',
      'link',
      'explanation',
    ] as const) {
      if (!text(q[k], k === 'body' || k === 'explanation' ? 20000 : 1000))
        return fail();
    }
    if (
      typeof q.phishing !== 'boolean' ||
      (publish &&
        (!q.subject.trim() || !q.body.trim() || !q.explanation.trim()))
    )
      return fail();
  }
  if (
    publish &&
    (!c.blocks.length ||
      !c.questions.length ||
      c.blocks.some((b) => b.type === 'text' && !b.text?.trim()))
  )
    return fail();
  return {
    title: c.title.trim(),
    description: c.description,
    passMark: c.passMark,
    blocks: c.blocks.map((b) => ({
      id: b.id,
      type: b.type,
      ...(b.text !== undefined ? { text: b.text } : {}),
      ...(b.url ? { url: b.url } : {}),
      ...(b.caption !== undefined ? { caption: b.caption } : {}),
    })),
    questions: c.questions.map((q) => ({
      id: q.id,
      subject: q.subject,
      sender: q.sender,
      address: q.address,
      body: q.body,
      link: q.link,
      phishing: q.phishing,
      explanation: q.explanation,
    })),
    reminder: c.reminder,
  };
}
export function publicContent(content: TrainingContent) {
  return {
    ...content,
    questions: content.questions.map(
      ({ phishing: _p, explanation: _e, ...q }) => q,
    ),
  };
}
export function scoreAnswers(
  content: TrainingContent,
  answers: { questionId: string; choice: boolean }[],
) {
  if (
    answers.length !== content.questions.length ||
    new Set(answers.map((a) => a.questionId)).size !== answers.length ||
    answers.some((a) => !content.questions.some((q) => q.id === a.questionId))
  )
    throw new BadRequestException('Сначала ответьте на все задания');
  const correct = content.questions.filter((q) =>
    answers.some((a) => a.questionId === q.id && a.choice === q.phishing),
  ).length;
  const score = Math.floor((correct / content.questions.length) * 100);
  return {
    score,
    passed: correct * 100 >= content.passMark * content.questions.length,
    correct,
    total: content.questions.length,
  };
}
export function mediaKind(
  b: Buffer,
  mime: string,
): { kind: 'image' | 'video'; ext: string } | null {
  if (
    mime === 'image/png' &&
    b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return { kind: 'image', ext: '.png' };
  if (mime === 'image/jpeg' && b[0] === 255 && b[1] === 216 && b[2] === 255)
    return { kind: 'image', ext: '.jpg' };
  if (
    mime === 'image/webp' &&
    b.toString('ascii', 0, 4) === 'RIFF' &&
    b.toString('ascii', 8, 12) === 'WEBP'
  )
    return { kind: 'image', ext: '.webp' };
  if (mime === 'video/mp4' && b.toString('ascii', 4, 8) === 'ftyp')
    return { kind: 'video', ext: '.mp4' };
  if (
    mime === 'video/webm' &&
    b.subarray(0, 4).equals(Buffer.from([26, 69, 223, 163]))
  )
    return { kind: 'video', ext: '.webm' };
  return null;
}
