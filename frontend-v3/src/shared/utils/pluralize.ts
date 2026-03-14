/**
 * Russian pluralization
 * pluralize(1, 'машина', 'машины', 'машин') → 'машина'
 * pluralize(3, 'машина', 'машины', 'машин') → 'машины'
 * pluralize(5, 'машина', 'машины', 'машин') → 'машин'
 */
export function pluralize(n: number, one: string, few: string, many: string): string {
  const abs = Math.abs(n) % 100;
  const last = abs % 10;
  if (abs > 10 && abs < 20) return many;
  if (last > 1 && last < 5) return few;
  if (last === 1) return one;
  return many;
}

// Pre-built helpers
export const pVehicle = (n: number) => `${n} ${pluralize(n, 'машина', 'машины', 'машин')}`;
export const pDriver = (n: number) => `${n} ${pluralize(n, 'водитель', 'водителя', 'водителей')}`;
export const pProblem = (n: number) => `${n} ${pluralize(n, 'проблема', 'проблемы', 'проблем')}`;
export const pCritical = (n: number) => `${n} ${pluralize(n, 'критическая проблема', 'критические проблемы', 'критических проблем')}`;
export const pRepair = (n: number) => `${n} ${pluralize(n, 'ремонт', 'ремонта', 'ремонтов')}`;
export const pAlert = (n: number) => `${n} ${pluralize(n, 'алерт', 'алерта', 'алертов')}`;
export const pOrder = (n: number) => `${n} ${pluralize(n, 'заказ', 'заказа', 'заказов')}`;
export const pDay = (n: number) => `${n} ${pluralize(n, 'день', 'дня', 'дней')}`;
export const pHour = (n: number) => `${n} ${pluralize(n, 'час', 'часа', 'часов')}`;
export const pMinute = (n: number) => `${n} ${pluralize(n, 'минута', 'минуты', 'минут')}`;
