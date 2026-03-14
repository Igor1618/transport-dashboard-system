// utils/report-helpers.ts — Утилиты для страницы отчёта
// Extracted from page.tsx during refactor (14 Mar 2026)

/** Латиница → кириллица для номерных знаков */
const LATIN_TO_CYRILLIC: Record<string, string> = {
  'A':'А','B':'В','C':'С','E':'Е','H':'Н','K':'К','M':'М','O':'О','P':'Р','T':'Т','X':'Х','Y':'У',
  'a':'А','b':'В','c':'С','e':'Е','h':'Н','k':'К','m':'М','o':'О','p':'Р','t':'Т','x':'Х','y':'У',
};

/** Нормализация номерного знака: латиница → кириллица + uppercase */
export function normPlate(s: string): string {
  return s.split('').map(c => LATIN_TO_CYRILLIC[c] || c).join('').toUpperCase();
}
