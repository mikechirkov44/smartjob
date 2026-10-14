export const OTHER_CHOICE_ID = '__other__';

export type ChoiceOption = {
  id: string;
  label: string;
};

export type ChoiceAnswer = {
  choiceId: string;
  otherText?: string;
};

export type MultiAnswer = {
  choiceIds: string[];
  otherText?: string;
};

export function isChoiceOptions(value: unknown): value is ChoiceOption[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        item &&
        typeof item === 'object' &&
        typeof (item as ChoiceOption).id === 'string' &&
        typeof (item as ChoiceOption).label === 'string',
    )
  );
}

export function parseChoiceAnswer(value: unknown): ChoiceAnswer | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.choiceId !== 'string' || !raw.choiceId.trim()) return null;
  const otherText =
    typeof raw.otherText === 'string' ? raw.otherText.trim() : undefined;
  return {
    choiceId: raw.choiceId.trim(),
    otherText: otherText || undefined,
  };
}

export function parseMultiAnswer(value: unknown): MultiAnswer | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  const source = raw.choiceIds;
  const parts = Array.isArray(source)
    ? source
    : typeof source === 'string'
      ? source.split(',')
      : [];
  const choiceIds = [
    ...new Set(
      parts
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
  if (!choiceIds.length) return null;
  const otherText =
    typeof raw.otherText === 'string' ? raw.otherText.trim() : undefined;
  return { choiceIds, otherText: otherText || undefined };
}

export function formatChoiceLabels(
  choices: ChoiceOption[],
  choiceIds: string[],
  otherText?: string,
): string {
  const labels = choices
    .filter((choice) => choiceIds.includes(choice.id))
    .map((choice) => choice.label);
  if (choiceIds.includes(OTHER_CHOICE_ID) && otherText) labels.push(otherText);
  return labels.join('; ');
}
