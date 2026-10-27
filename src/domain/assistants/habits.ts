import type { Snapshot } from "../types";
import { addDays, dayKey, daysBetween, localParts, weekdayOf } from "../time";
import { busyMapOf, freeSlots, MIN_LEAD_MIN } from "../availability";

/**
 * How a customer usually books: day of the week, time, barber, services and who comes along,
 * read from their completed visits. Used for "O de sempre" (one tap to book the usual) and to
 * mark "seu horário de sempre" among the free times.
 */
export interface Habit {
  customerId: string;
  visits: number;
  /** Most common weekday (0 = Sunday), when one clearly stands out. */
  weekday: number | null;
  /** Usual start time, minutes after midnight (median). */
  minute: number;
  barberId: string | null;
  unitId: string | null;
  /** The usual set of services (the most frequent combination). */
  serviceIds: string[];
  /** People of the same account who usually come in the same group. */
  companions: string[];
  /** Days between visits (their own rhythm, or the profile's cycle). */
  rhythmDays: number;
  lastVisit: string;
  /** Day they are due back. */
  dueOn: string;
}

const HABIT_VISITS = 8;

const habitCache = new WeakMap<Snapshot, Map<string, Habit | null>>();

export function customerHabit(s: Snapshot, customerId: string): Habit | null {
  const cache = habitCache.get(s) ?? habitCache.set(s, new Map()).get(s)!;
  if (!cache.has(customerId)) cache.set(customerId, computeHabit(s, customerId));
  return cache.get(customerId)!;
}

function computeHabit(s: Snapshot, customerId: string): Habit | null {
  const customer = s.customers.find((c) => c.id === customerId);
  if (!customer) return null;
  const visits = s.appointments
    .filter((a) => a.customerId === customerId && a.status === "completed" && a.startsAt <= s.now)
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt))
    .slice(0, HABIT_VISITS);
  if (visits.length < 2) return null;

  const count = <T,>(xs: T[]) => {
    const m = new Map<T, number>();
    for (const x of xs) m.set(x, (m.get(x) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  const days = visits.map((v) => dayKey(v.startsAt));
  const weekdays = count(days.map(weekdayOf));
  const minutes = visits.map((v) => localParts(v.startsAt).minutes).sort((a, b) => a - b);
  const barbers = count(visits.map((v) => v.barberId));
  const combos = count(visits.map((v) => [...v.serviceIds].sort().join(",")));
  const gaps = days.slice(0, -1).map((d, i) => daysBetween(days[i + 1], d));
  const rhythm = gaps.length ? Math.round(gaps.reduce((t, g) => t + g, 0) / gaps.length) : customer.cycleDays;

  // Companions: same group id, same account, in at least half of the visits.
  const holder = customer.holderId ?? customer.id;
  const groupIds = new Set(visits.map((v) => v.groupId).filter(Boolean));
  const together = new Map<string, number>();
  for (const a of s.appointments) {
    if (!a.groupId || !groupIds.has(a.groupId) || a.customerId === customerId) continue;
    const other = s.customers.find((c) => c.id === a.customerId);
    if (!other || (other.holderId ?? other.id) !== holder) continue;
    together.set(a.customerId, (together.get(a.customerId) ?? 0) + 1);
  }
  const lastBarber = barbers[0]?.[0] ?? null;

  return {
    customerId,
    visits: visits.length,
    weekday: weekdays[0] && weekdays[0][1] >= Math.max(2, visits.length / 2) ? weekdays[0][0] : null,
    minute: minutes[Math.floor(minutes.length / 2)],
    barberId: lastBarber,
    unitId: lastBarber ? (s.barbers.find((b) => b.id === lastBarber)?.unitId ?? null) : null,
    serviceIds: combos[0][0].split(",").sort((a, b) => s.services.findIndex((x) => x.id === a) - s.services.findIndex((x) => x.id === b)),
    companions: [...together.entries()].filter(([, n]) => n >= visits.length / 2).map(([id]) => id),
    rhythmDays: rhythm,
    lastVisit: days[0],
    dueOn: addDays(days[0], rhythm),
  };
}

/** The free start closest to the usual time (within 90 minutes), or null. */
export function usualStart(minute: number, starts: number[]): number | null {
  let best: number | null = null;
  for (const t of starts) if (Math.abs(t - minute) <= 90 && (best === null || Math.abs(t - minute) < Math.abs(best - minute))) best = t;
  return best;
}

export interface UsualBooking {
  habit: Habit;
  day: string;
  start: number;
  barberId: string;
  unitId: string;
  /** Customer + companions, all with a free chair side by side. */
  customerIds: string[];
}

/**
 * The next "O de sempre": the first day from when they are due (or today), inside the booking
 * window, where the usual barber is free near the usual time — preferring the usual weekday.
 * Companions come along only when there are free chairs for them at the same time.
 */
export function nextUsualBooking(s: Snapshot, customerId: string, windowDays = 8): UsualBooking | null {
  const habit = customerHabit(s, customerId);
  if (!habit?.barberId || !habit.unitId) return null;
  const barber = s.barbers.find((b) => b.id === habit.barberId && b.active);
  const unit = s.units.find((u) => u.id === habit.unitId);
  if (!barber || !unit) return null;
  if (s.appointments.some((a) => a.customerId === customerId && a.status === "scheduled" && a.startsAt >= s.now)) return null;

  const today = dayKey(s.now);
  const nowMin = localParts(s.now).minutes;
  const last = addDays(today, windowDays - 1);
  const busy = busyMapOf(s, today, last);
  const duration = habit.serviceIds.reduce((t, id) => t + (s.services.find((x) => x.id === id)?.durationMin ?? 30), 0);
  const from = habit.dueOn > today ? habit.dueOn : today;
  const days: string[] = [];
  for (let d = from > last ? last : from; d <= last; d = addDays(d, 1)) days.push(d);
  // Usual weekday first, then the earliest day.
  days.sort((a, b) => Number(weekdayOf(b) === habit.weekday) - Number(weekdayOf(a) === habit.weekday) || a.localeCompare(b));
  const others = s.barbers.filter((b) => b.active && b.unitId === unit.id && b.id !== barber.id);

  for (const day of days) {
    const hours = unit.hours[weekdayOf(day)];
    const starts = freeSlots(hours, busy[barber.id]?.[day], duration, day === today ? nowMin : null).filter((t) => day !== today || t >= nowMin + MIN_LEAD_MIN);
    const start = usualStart(habit.minute, starts);
    if (start === null) continue;
    const free = others.filter((b) => !(busy[b.id]?.[day] ?? []).some(([a, e]) => start < e && start + duration > a));
    // Booking together uses the same services for everyone: only companions with the same usual services come along.
    const same = habit.companions.filter((id) => customerHabit(s, id)?.serviceIds.join(",") === habit.serviceIds.join(","));
    const companions = same.slice(0, free.length);
    return { habit, day, start, barberId: barber.id, unitId: unit.id, customerIds: [customerId, ...companions] };
  }
  return null;
}
