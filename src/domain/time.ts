/**
 * Time helpers in São Paulo wall time. Brazil has had no daylight saving since 2019,
 * so São Paulo is a fixed UTC−3 and the math works the same on any server timezone.
 */
export const SP_OFFSET_MIN = -180;
const MS_MIN = 60_000;
const MS_DAY = 86_400_000;

export interface LocalParts {
  year: number;
  month: number; // 1–12
  day: number;
  weekday: number; // 0 = Sunday
  minutes: number; // minutes after midnight
}

export function localParts(date: Date | string): LocalParts {
  const d = new Date(typeof date === "string" ? date : date.getTime());
  const shifted = new Date(d.getTime() + SP_OFFSET_MIN * MS_MIN);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    weekday: shifted.getUTCDay(),
    minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  };
}

/** "2026-10-20" for the São Paulo calendar day of a moment. */
export function dayKey(date: Date | string): string {
  const p = localParts(date);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** UTC instant for a São Paulo day key plus minutes after midnight. */
export function fromLocal(key: string, minutes: number): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d) + (minutes - SP_OFFSET_MIN) * MS_MIN);
}

export function addDays(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d) + days * MS_DAY);
  return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, "0")}-${String(t.getUTCDate()).padStart(2, "0")}`;
}

export function weekdayOf(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function daysBetween(fromKey: string, toKey: string): number {
  const [a, b] = [fromKey, toKey].map((k) => {
    const [y, m, d] = k.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  });
  return Math.round((b - a) / MS_DAY);
}

export function monthKey(date: Date | string): string {
  return dayKey(date).slice(0, 7);
}

export function hhmm(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

const WEEKDAYS_SHORT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const WEEKDAYS_LONG = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
const MONTHS_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MONTHS_LONG = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export function weekdayShort(key: string): string {
  return WEEKDAYS_SHORT[weekdayOf(key)];
}

export function weekdayLong(key: string): string {
  return WEEKDAYS_LONG[weekdayOf(key)];
}

/** "20 out" */
export function shortDate(key: string): string {
  const [, m, d] = key.split("-").map(Number);
  return `${d} ${MONTHS_SHORT[m - 1]}`;
}

/** "outubro de 2026" */
export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${MONTHS_LONG[m - 1]} de ${y}`;
}

export function monthShort(month: string): string {
  const [, m] = month.split("-").map(Number);
  return MONTHS_SHORT[m - 1];
}

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}
