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
];

export function coverSrc(id?: string | null) {
  return (
    COVER_PRESETS.find((p) => p.id === id)?.src || COVER_PRESETS[0].src
  );
}
