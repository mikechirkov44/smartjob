const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Черновик',
  ACTIVE: 'Активен',
  CLOSED: 'Закрыт',
};

export function statusLabel(status: string) {
  return STATUS_LABELS[status] || status;
}

export function statusBadgeClass(status: string) {
  if (status === 'ACTIVE') return 'ok';
  if (status === 'CLOSED') return 'warn';
  return 'muted';
}
