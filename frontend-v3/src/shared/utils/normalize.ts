// Нормализация номера ТС: латиница → кириллица, убрать пробелы
const LAT_TO_CYR: Record<string, string> = {
  A: 'А', B: 'В', C: 'С', E: 'Е', H: 'Н', K: 'К', M: 'М',
  O: 'О', P: 'Р', T: 'Т', X: 'Х', Y: 'У',
  a: 'а', b: 'в', c: 'с', e: 'е', h: 'н', k: 'к', m: 'м',
  o: 'о', p: 'р', t: 'т', x: 'х', y: 'у',
};

export function normalizeVehicleNumber(num: string): string {
  return num
    .replace(/[\s\/]/g, '')
    .split('')
    .map(c => LAT_TO_CYR[c] || c)
    .join('')
    .toUpperCase();
}
