import type { OpeningHours } from "./types";

/** Busy intervals of one barber on one day, in minutes after midnight. */
export type BusyDay = [start: number, end: number][];
/** barberId → dayKey → busy intervals. */
export type BusyMap = Record<string, Record<string, BusyDay>>;

export const SLOT_STEP_MIN = 30;
/** Earliest a same-day booking can start, counted from now. */
export const MIN_LEAD_MIN = 30;

export function isFree(busy: BusyDay | undefined, start: number, end: number): boolean {
  return !(busy ?? []).some(([s, e]) => start < e && end > s);
}

/**
 * Start times (minutes) where a service of `durationMin` fits for a barber.
 * `nowMinutes` is set only for today, so past slots are dropped.
 */
export function freeSlots(hours: OpeningHours | null, busy: BusyDay | undefined, durationMin: number, nowMinutes: number | null): number[] {
  if (!hours) return [];
  const earliest = nowMinutes === null ? hours.open : Math.max(hours.open, nowMinutes + MIN_LEAD_MIN);
  const out: number[] = [];
  for (let t = hours.open; t + durationMin <= hours.close; t += SLOT_STEP_MIN) {
    if (t < earliest) continue;
    if (isFree(busy, t, t + durationMin)) out.push(t);
  }
  return out;
}

/**
 * Picks `count` distinct barbers free at `start` for `durationMin`, starting with the
 * preferred one when it is free. Returns null when there are not enough free barbers.
 */
export function assignBarbers(
  candidates: string[],
  busy: BusyMap,
  day: string,
  start: number,
  durationMin: number,
  count: number,
  preferred: string | null,
): string[] | null {
  const free = candidates.filter((id) => isFree(busy[id]?.[day], start, start + durationMin));
  const ordered = preferred && free.includes(preferred) ? [preferred, ...free.filter((id) => id !== preferred)] : free;
  if (preferred && !free.includes(preferred)) return null;
  return ordered.length >= count ? ordered.slice(0, count) : null;
}

export interface BookingUnit {
  id: string;
  hours: (OpeningHours | null)[];
  barberIds: string[];
}

export interface BookingQuery {
  units: BookingUnit[];
  /** null = any unit. */
  unitId: string | null;
  /** null = no preference. */
  barberId: string | null;
  day: string;
  weekday: number;
  start: number;
  durationMin: number;
  people: number;
  busy: BusyMap;
  /** Minutes after midnight now, only when `day` is today. */
  nowMinutes: number | null;
}

/** Unit and barbers (one per person, side by side) for a booking, or null when it does not fit. */
export function planBooking(q: BookingQuery): { unitId: string; barberIds: string[] } | null {
  if (q.nowMinutes !== null && q.start < q.nowMinutes + MIN_LEAD_MIN) return null;
  for (const unit of q.units) {
    if (q.unitId && unit.id !== q.unitId) continue;
    if (q.barberId && !unit.barberIds.includes(q.barberId)) continue;
    const hours = unit.hours[q.weekday];
    if (!hours || q.start < hours.open || q.start + q.durationMin > hours.close) continue;
    const barberIds = assignBarbers(unit.barberIds, q.busy, q.day, q.start, q.durationMin, q.people, q.barberId);
    if (barberIds) return { unitId: unit.id, barberIds };
  }
  return null;
}

/** Every start time on a day where `planBooking` finds room. */
export function bookableStarts(q: Omit<BookingQuery, "start">): number[] {
  const hours = q.units.map((u) => u.hours[q.weekday]).filter((h): h is OpeningHours => Boolean(h));
  if (!hours.length) return [];
  const open = Math.min(...hours.map((h) => h.open));
  const close = Math.max(...hours.map((h) => h.close));
  const out: number[] = [];
  for (let t = open; t + q.durationMin <= close; t += SLOT_STEP_MIN) {
    if (planBooking({ ...q, start: t })) out.push(t);
  }
  return out;
}
