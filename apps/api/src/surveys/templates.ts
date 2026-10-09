export type TemplateQuestion = {
  metric: string;
  category?: string;
  text: string;
  type?: 'LIKERT' | 'ENPS' | 'TEXT';
  scaleMax?: number;
  scaleMinLabel?: string;
  scaleMaxLabel?: string;
};

export const FULL_TEMPLATE: TemplateQuestion[] = [
  { metric: 'Руководитель', category: 'engagement', text: 'Мой руководитель чётко ставит задачи и объясняет ожидаемые результаты' },
  { metric: 'Руководитель', category: 'engagement', text: 'Я доверяю своему руководителю и чувствую поддержку с его стороны' },
  { metric: 'Стратегия', category: 'engagement', text: 'Я понимаю стратегию и цели своей компании' },
  { metric: 'Стратегия', category: 'engagement', text: 'Цели компании реалистичны и адаптируются к изменениям' },
  { metric: 'Признание', category: 'engagement', text: 'Меня признают за хорошо выполненную работу' },
  { metric: 'Признание', category: 'engagement', text: 'В компании принято искренне и своевременно хвалить сотрудников' },
  { metric: 'Обратная связь', category: 'engagement', text: 'Я регулярно получаю полезную обратную связь от руководителя' },
  { metric: 'Обратная связь', category: 'engagement', text: 'Обратная связь помогает мне улучшать результаты работы' },
  { metric: 'Процессы', category: 'engagement', text: 'Я проявляю инициативу и предлагаю улучшения в работе' },
  { metric: 'Процессы', category: 'engagement', text: 'Мне интересны задачи, которые я выполняю' },
  { metric: 'Изменения', category: 'engagement', text: 'У меня достаточно ресурсов для выполнения сложных задач' },
  { metric: 'Изменения', category: 'engagement', text: 'Я своевременно информирован о предстоящих изменениях в компании' },
  { metric: 'Коллеги', category: 'engagement', text: 'В моей команде комфортная и доверительная атмосфера' },
  { metric: 'Коллеги', category: 'engagement', text: 'Коммуникация с коллегами эффективна и конструктивна' },
  { metric: 'Баланс', category: 'engagement', text: 'У меня есть возможность поддерживать баланс работы и личной жизни' },
  { metric: 'Баланс', category: 'engagement', text: 'Я могу заботиться о своём здоровье и психологическом комфорте' },
  { metric: 'Карьера', category: 'engagement', text: 'Я вижу возможности для профессионального роста в компании' },
  { metric: 'Карьера', category: 'engagement', text: 'У меня достаточно автономии в принятии рабочих решений' },
  { metric: 'Условия и оплата', category: 'engagement', text: 'Я удовлетворён условиями труда на своём рабочем месте' },
  { metric: 'Условия и оплата', category: 'engagement', text: 'Уровень оплаты труда справедлив для моей должности' },
  { metric: 'Гордится компанией', category: 'loyalty', text: 'Я горжусь тем, что работаю в этой компании' },
  { metric: 'Рекомендует компанию', category: 'loyalty', text: 'Я готов(а) рекомендовать компанию как работодателя' },
  { metric: 'Остается сейчас', category: 'loyalty', text: 'Я не думаю о переходе на другую работу в ближайшее время' },
  { metric: 'Остается в будущем', category: 'loyalty', text: 'Я планирую работать в компании ещё как минимум 2 года' },
  { metric: 'Интерес', category: 'satisfaction', text: 'Моя работа интересна и увлекательна' },
  { metric: 'Условия труда', category: 'satisfaction', text: 'Условия труда на моём рабочем месте комфортны' },
  { metric: 'Льготы', category: 'satisfaction', text: 'Социальный пакет и льготы соответствуют моим ожиданиям' },
  { metric: 'Оплата', category: 'satisfaction', text: 'Уровень оплаты труда соответствует моему вкладу' },
  { metric: 'Безопасность', category: 'satisfaction', text: 'Я чувствую себя в безопасности на рабочем месте' },
];

export const PULSE_TEMPLATE: TemplateQuestion[] = [
  { metric: 'Руководитель', category: 'pulse', text: 'Я знаю, чего от меня ожидают на работе' },
  { metric: 'Условия и оплата', category: 'pulse', text: 'У меня есть материалы и оборудование для качественной работы' },
  { metric: 'Карьера', category: 'pulse', text: 'У меня есть возможность делать то, что я умею лучше всего' },
  { metric: 'Признание', category: 'pulse', text: 'За последние 7 дней меня похвалили за хорошую работу' },
  { metric: 'Руководитель', category: 'pulse', text: 'Мой руководитель заботится обо мне как о личности' },
  { metric: 'Карьера', category: 'pulse', text: 'В компании поощряют моё развитие' },
  { metric: 'Процессы', category: 'pulse', text: 'Моё мнение учитывается при принятии решений' },
];

/** Опрос «Условия труда» по корпоративной анкете (шкала 1–10). */
export const WORK_CONDITIONS_TEMPLATE: TemplateQuestion[] = [
  {
    metric: 'ФИО',
    category: 'profile',
    text: 'Укажите, пожалуйста, свои Фамилия и Имя',
    type: 'TEXT',
  },
  {
    metric: 'Удовлетворённость условиями',
    category: 'satisfaction',
    text: 'Насколько вы удовлетворены условиями труда на текущем месте работы?',
    scaleMax: 10,
  },
  {
    metric: 'Зарплата',
    category: 'satisfaction',
    text: 'Укажите уровень удовлетворённости данными факторами на текущем месте работы — уровень заработной платы',
    scaleMax: 10,
  },
  {
    metric: 'График',
    category: 'satisfaction',
    text: 'Укажите уровень удовлетворённости данными факторами на текущем месте работы — график/режим работы',
    scaleMax: 10,
  },
  {
    metric: 'Содержание труда',
    category: 'satisfaction',
    text: 'Укажите уровень удовлетворённости данными факторами на текущем месте работы — содержание труда (задачи, разнообразие, степень самостоятельности)',
    scaleMax: 10,
  },
  {
    metric: 'Обучение',
    category: 'satisfaction',
    text: 'Укажите уровень удовлетворённости данными факторами на текущем месте работы — возможность обучения и развития',
    scaleMax: 10,
  },
  {
    metric: 'Премия',
    category: 'satisfaction',
    text: 'Укажите уровень удовлетворённости данными факторами на текущем месте работы — отражение результатов работы в премиальной части',
    scaleMax: 10,
  },
  {
    metric: 'Важность: зарплата',
    category: 'importance',
    text: 'Укажите степень важности факторов в условиях работы лично для вас — уровень заработной платы',
    scaleMax: 10,
  },
  {
    metric: 'Важность: график',
    category: 'importance',
    text: 'Укажите степень важности факторов в условиях работы лично для вас — график/режим работы',
    scaleMax: 10,
  },
  {
    metric: 'Важность: содержание труда',
    category: 'importance',
    text: 'Укажите степень важности факторов в условиях работы лично для вас — содержание труда (задачи, разнообразие, степень самостоятельности)',
    scaleMax: 10,
  },
  {
    metric: 'Важность: обучение',
    category: 'importance',
    text: 'Укажите степень важности факторов в условиях работы лично для вас — возможность развития и обучения',
    scaleMax: 10,
  },
  {
    metric: 'Важность: премия',
    category: 'importance',
    text: 'Укажите степень важности факторов в условиях работы лично для вас — отражение результатов работы в премиальной части вашего дохода',
    scaleMax: 10,
  },
  {
    metric: 'eNPS',
    category: 'loyalty',
    text: 'Готовы ли вы рекомендовать вашу компанию друзьям в качестве потенциального места работы?',
    type: 'ENPS',
  },
  {
    metric: 'Взаимодействие внутри',
    category: 'engagement',
    text: 'Насколько вы удовлетворены взаимодействием внутри вашего подразделения?',
    scaleMax: 10,
  },
  {
    metric: 'Взаимодействие между',
    category: 'engagement',
    text: 'Насколько вы удовлетворены взаимодействием между подразделениями?',
    scaleMax: 10,
  },
  {
    metric: 'Оптимизация процессов',
    category: 'engagement',
    text: 'Насколько быстро рассматриваются ваши предложения по оптимизации процессов?',
    scaleMax: 10,
  },
  {
    metric: 'Поддержка идей',
    category: 'engagement',
    text: 'Чувствуете ли вы поддержку от руководства в продвижении своих идей?',
    scaleMax: 10,
  },
  {
    metric: 'Результат работы',
    category: 'engagement',
    text: 'Чувствуете ли вы, что ваша работа приносит результаты для компании?',
    scaleMax: 10,
  },
  {
    metric: 'Идеи улучшений',
    category: 'open',
    text: 'Поделитесь, какие изменения вы бы предложили для улучшения показателей компании?',
    type: 'TEXT',
  },
  {
    metric: 'Личные изменения',
    category: 'open',
    text: 'Что бы вы изменили в условиях работы лично для себя?',
    type: 'TEXT',
  },
  {
    metric: 'Значимые коллеги',
    category: 'open',
    text: 'Кого из сотрудников внутри вашего подразделения вы выделяете наиболее значимыми и полезными?',
    type: 'TEXT',
  },
];

export const ENPS_QUESTION: TemplateQuestion = {
  metric: 'eNPS',
  category: 'loyalty',
  text: 'Насколько вероятно, что вы порекомендуете компанию как место работы друзьям или знакомым?',
  type: 'ENPS',
};

export function mapQuestionType(
  type?: TemplateQuestion['type'] | string | null,
): 'LIKERT' | 'ENPS' | 'TEXT' {
  if (type === 'ENPS') return 'ENPS';
  if (type === 'TEXT') return 'TEXT';
  return 'LIKERT';
}
