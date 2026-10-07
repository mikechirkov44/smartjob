export type CoverPreset = {
  id: string;
  label: string;
  src: string;
};

export const COVER_PRESETS: CoverPreset[] = [
  {
    id: 'team-collab',
    label: 'Команда',
    src: '/illustrations/team-collab.svg',
  },
  {
    id: 'feedback',
    label: 'Обратная связь',
    src: '/illustrations/feedback.svg',
  },
  {
    id: 'growth',
    label: 'Рост',
    src: '/illustrations/growth.svg',
  },
  {
    id: 'pulse',
    label: 'Пульс',
    src: '/illustrations/pulse.svg',
  },
  {
    id: 'celebrate',
    label: 'Успех',
    src: '/illustrations/celebrate.svg',
  },
  {
    id: 'work-conditions',
    label: 'Условия труда',
    src: '/illustrations/work-conditions.svg',
  },
  {
    id: 'office',
    label: 'Офис',
    src: '/illustrations/office.svg',
  },
  {
    id: 'analytics',
    label: 'Аналитика',
    src: '/illustrations/analytics.svg',
  },
];

export function coverSrc(id?: string | null) {
  return COVER_PRESETS.find((p) => p.id === id)?.src || COVER_PRESETS[0].src;
}
