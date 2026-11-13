import {
  validateContent,
  scoreAnswers,
  publicContent,
  mediaKind,
} from './training.content';
const content = {
  title: 'Курс',
  description: 'Описание',
  passMark: 80,
  blocks: [{ id: 'b', type: 'text', text: 'Теория' }],
  questions: [
    {
      id: 'q',
      subject: 'Письмо',
      sender: 'Банк',
      address: 'help@example.test',
      body: 'Текст',
      link: 'https://example.test',
      phishing: true,
      explanation: 'Подмена домена',
    },
  ],
  reminder: 'Проверяйте домен',
};
describe('training content', () => {
  it('validates and rejects invalid lessons', () => {
    expect(validateContent(content)).toEqual(content);
    expect(() => validateContent({ ...content, questions: [] })).toThrow();
    expect(() =>
      validateContent({
        ...content,
        blocks: [{ id: 'b', type: 'video', url: 'javascript:alert(1)' }],
      }),
    ).toThrow();
  });
  it('never exposes correct answers before answering', () => {
    const q = publicContent(content).questions[0];
    expect(q).not.toHaveProperty('phishing');
    expect(q).not.toHaveProperty('explanation');
  });
  it('scores on server and requires every answer', () => {
    expect(scoreAnswers(content, [{ questionId: 'q', choice: true }])).toEqual({
      score: 100,
      passed: true,
      correct: 1,
      total: 1,
    });
    expect(() => scoreAnswers(content, [])).toThrow();
    expect(() =>
      scoreAnswers(content, [{ questionId: 'x', choice: true }]),
    ).toThrow();
  });
  it('rejects duplicate IDs and invalid pass marks', () => {
    expect(() =>
      validateContent({
        ...content,
        questions: [content.questions[0], content.questions[0]],
      }),
    ).toThrow();
    expect(() => validateContent({ ...content, passMark: 101 })).toThrow();
  });
  it('checks actual media bytes', () => {
    expect(mediaKind(Buffer.from('not a png'), 'image/png')).toBeNull();
    expect(
      mediaKind(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), 'image/png'),
    ).toEqual({ kind: 'image', ext: '.png' });
  });
});

describe('exact pass threshold', () => {
  it('does not round a failing raw percentage up to a pass', () => {
    const c = {
      ...content,
      questions: Array.from({ length: 44 }, (_, i) => ({
        ...content.questions[0],
        id: String(i),
      })),
    };
    const answers = c.questions.map((q, i) => ({
      questionId: q.id,
      choice: i < 35,
    }));
    expect(scoreAnswers(c, answers).passed).toBe(false);
  });
});
