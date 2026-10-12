import type { SelectOption } from './components/CustomSelect';

export type QuestionKind = 'TEXT' | 'LIKERT_5' | 'LIKERT_10' | 'GRID';

export type GridRow = { id: string; label: string };
export type GridColumn = { id: string; label: string; value?: number | null };

export const QUESTION_KIND_OPTIONS: SelectOption[] = [
  { value: 'TEXT', label: 'Текст' },
  { value: 'LIKERT_5', label: 'Шкала 1–5' },
  { value: 'LIKERT_10', label: 'Шкала 1–10' },
  { value: 'GRID', label: 'Сетка (множественный выбор)' },
];

export const METRIC_OPTIONS: SelectOption[] = [
  { value: 'Общее', label: 'Общее' },
  { value: 'Руководитель', label: 'Руководитель' },
  { value: 'Стратегия', label: 'Стратегия' },
  { value: 'Признание', label: 'Признание' },
  { value: 'Обратная связь', label: 'Обратная связь' },
  { value: 'Процессы', label: 'Процессы' },
  { value: 'Изменения', label: 'Изменения' },
  { value: 'Коллеги', label: 'Коллеги' },
  { value: 'Баланс', label: 'Баланс' },
  { value: 'Карьера', label: 'Карьера' },
  { value: 'Условия и оплата', label: 'Условия и оплата' },
  { value: 'Удовлетворённость условиями', label: 'Удовлетворённость условиями' },
  { value: 'Зарплата', label: 'Зарплата' },
  { value: 'График', label: 'График' },
  { value: 'Содержание труда', label: 'Содержание труда' },
  { value: 'ФИО', label: 'ФИО' },
  { value: 'eNPS', label: 'eNPS' },
];

export const CATEGORY_OPTIONS: SelectOption[] = [
  { value: 'custom', label: 'Свой' },
  { value: 'engagement', label: 'Вовлечённость' },
  { value: 'loyalty', label: 'Лояльность' },
  { value: 'satisfaction', label: 'Удовлетворённость' },
  { value: 'pulse', label: 'Пульс' },
  { value: 'importance', label: 'Важность' },
  { value: 'profile', label: 'Профиль' },
  { value: 'open', label: 'Открытый ответ' },
];

export type EditorQuestion = {
  text: string;
  metric: string;
  category: string;
  kind: QuestionKind;
  scaleMinLabel: string;
  scaleMaxLabel: string;
  gridRows: GridRow[];
  gridColumns: GridColumn[];
  requireAllRows: boolean;
};

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}`;
}

export function defaultGridColumns(): GridColumn[] {
  return [1, 2, 3, 4, 5].map((n) => ({
    id: uid('c'),
    label: String(n),
    value: n,
  }));
}

export function defaultGridRows(): GridRow[] {
  return [
    { id: uid('r'), label: '' },
    { id: uid('r'), label: '' },
  ];
}

export function emptyQuestion(): EditorQuestion {
  return {
    text: '',
    metric: 'Общее',
    category: 'custom',
    kind: 'LIKERT_5',
    scaleMinLabel: '',
    scaleMaxLabel: '',
    gridRows: defaultGridRows(),
    gridColumns: defaultGridColumns(),
    requireAllRows: true,
  };
}

export function kindFromApi(type: string, scaleMax?: number): QuestionKind {
  if (type === 'TEXT') return 'TEXT';
  if (type === 'GRID') return 'GRID';
  if (type === 'ENPS') return 'LIKERT_10';
  return scaleMax === 10 ? 'LIKERT_10' : 'LIKERT_5';
}

export function toApiQuestion(q: EditorQuestion) {
  if (q.kind === 'TEXT') {
    return {
      text: q.text,
      metric: q.metric,
      category: q.category,
      type: 'TEXT' as const,
    };
  }
  if (q.kind === 'GRID') {
    return {
      text: q.text,
      metric: q.metric,
      category: q.category,
      type: 'GRID' as const,
      requireAllRows: q.requireAllRows,
      gridRows: q.gridRows
        .map((r) => ({ id: r.id, label: r.label.trim() }))
        .filter((r) => r.label),
      gridColumns: q.gridColumns
        .map((c) => ({
          id: c.id,
          label: c.label.trim(),
          value: c.value == null || Number.isNaN(Number(c.value)) ? null : Number(c.value),
        }))
        .filter((c) => c.label),
    };
  }
  return {
    text: q.text,
    metric: q.metric,
    category: q.category,
    type: 'LIKERT' as const,
    scaleMax: q.kind === 'LIKERT_10' ? 10 : 5,
    scaleMinLabel: q.scaleMinLabel.trim() || undefined,
    scaleMaxLabel: q.scaleMaxLabel.trim() || undefined,
  };
}

export { uid as newGridId };
