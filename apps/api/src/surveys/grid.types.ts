export type GridRow = {
  id: string;
  label: string;
};

export type GridColumn = {
  id: string;
  label: string;
  /** Numeric score for analytics; null/undefined = skip (e.g. N/A). */
  value?: number | null;
};

export function isGridRows(value: unknown): value is GridRow[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        item &&
        typeof item === 'object' &&
        typeof (item as GridRow).id === 'string' &&
        typeof (item as GridRow).label === 'string',
    )
  );
}

export function isGridColumns(value: unknown): value is GridColumn[] {
  return (
    Array.isArray(value) &&
    value.every((item) => {
      if (!item || typeof item !== 'object') return false;
      const col = item as GridColumn;
      if (typeof col.id !== 'string' || typeof col.label !== 'string') return false;
      if (col.value != null && typeof col.value !== 'number') return false;
      return true;
    })
  );
}

export function parseGridAnswer(value: unknown): Record<string, string> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const out: Record<string, string> = {};
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (typeof val === 'string' && val.trim()) out[key] = val;
  }
  return out;
}
