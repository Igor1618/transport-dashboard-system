// Форматирование валюты
export function formatCurrency(value: number): string {
  return value.toLocaleString('ru-RU');
}

// Форматирование даты DD.MM.YYYY
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow' });
}

// Форматирование даты DD.MM
export function formatShortDate(date: string | Date | null | undefined): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Moscow' });
}

// Обрезка строки
export function truncate(str: string | null | undefined, max: number): string {
  if (!str) return '—';
  return str.length > max ? str.slice(0, max) + '…' : str;
}
