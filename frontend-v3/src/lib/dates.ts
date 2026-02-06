// Хелперы для форматирования дат в московском времени

const MSK = 'Europe/Moscow';

/** DD.MM.YYYY */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('ru-RU', { timeZone: MSK, day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** DD.MM.YYYY HH:mm */
export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('ru-RU', { timeZone: MSK, day: '2-digit', month: '2-digit', year: 'numeric' }) 
    + ' ' + d.toLocaleTimeString('ru-RU', { timeZone: MSK, hour: '2-digit', minute: '2-digit' });
}

/** DD.MM */
export function formatShortDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('ru-RU', { timeZone: MSK, day: '2-digit', month: '2-digit' });
}

/** HH:mm */
export function formatTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('ru-RU', { timeZone: MSK, hour: '2-digit', minute: '2-digit' });
}
