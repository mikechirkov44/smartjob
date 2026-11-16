import {
  validateContent,
  publicContent,
  scoreAnswers,
  evaluateAnswer,
} from './training.content';
const question: any = {
  id: 'q',
  type: 'multi',
  subject: 'Данные для ИИ',
  body: 'Выберите все секреты',
  sender: '',
  address: '',
  link: '',
  phishing: false,
  options: [
    { id: 'a', text: 'Пароль' },
    { id: 'b', text: 'Публичный текст' },
    { id: 'c', text: 'Токен' },
  ],
  correctOptionIds: ['a', 'c'],
  explanation: 'Секреты не передают',
};
const course: any = {
  title: 'Курс',
  description: '',
  blocks: [{ id: 'b', type: 'text', text: 'Материал' }],
  questions: [question],
  passMark: 80,
  reminder: '',
};
describe('typed assignments', () => {
  it('requires the complete multi-selection, independent of order', () => {
    expect(evaluateAnswer(question, undefined, ['c', 'a'])).toBe(true);
    expect(evaluateAnswer(question, undefined, ['a'])).toBe(false);
    expect(evaluateAnswer(question, undefined, ['a', 'b', 'c'])).toBe(false);
  });
  it('rejects duplicate and unknown selections', () => {
    expect(() => evaluateAnswer(question, undefined, ['a', 'a'])).toThrow();
    expect(() => evaluateAnswer(question, undefined, ['unknown'])).toThrow();
  });
  it('validates each assignment kind and strips correct keys from public content', () => {
    expect(validateContent(course).questions[0].type).toBe('multi');
    expect(publicContent(course).questions[0]).not.toHaveProperty(
      'correctOptionIds',
    );
    for (const type of ['single', 'situation', 'truefalse']) {
      const q = {
        ...question,
        type,
        options:
          type === 'truefalse'
            ? [
                { id: 'true', text: 'Верно' },
                { id: 'false', text: 'Неверно' },
              ]
            : question.options,
        correctOptionIds: [type === 'truefalse' ? 'true' : 'a'],
      };
      expect(
        validateContent({ ...course, questions: [q] }).questions[0].type,
      ).toBe(type);
    }
  });
  it('rejects a single question with two correct answers and missing variant', () => {
    expect(() =>
      validateContent({
        ...course,
        questions: [{ ...question, type: 'single' }],
      }),
    ).toThrow();
    expect(() =>
      validateContent({
        ...course,
        questions: [{ ...question, correctOptionIds: ['missing'] }],
      }),
    ).toThrow();
  });
  it('scores selection and legacy email together', () => {
    const legacy = {
      ...question,
      id: 'email',
      type: undefined,
      phishing: true,
    };
    const c = { ...course, questions: [question, legacy] };
    expect(
      scoreAnswers(c, [
        { questionId: 'q', choice: false, selection: ['a', 'c'] },
        { questionId: 'email', choice: true },
      ]).score,
    ).toBe(100);
  });
});
