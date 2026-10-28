import type { Barber, Customer, Snapshot } from "../types";
import { addDays, dayKey, localParts, weekdayOf } from "../time";
import { busyMapOf, freeSlots } from "../availability";
import { expectedReturn, visitStats } from "./history";
import { customerHabit } from "./habits";

/**
 * Filling empty chairs: for each barber, the free times of a day and the customers of that
 * barber who are due (or past due) and usually come at that time. The offer goes out as a
 * message; nothing is booked without the customer saying yes.
 */

export interface GapWindow {
  start: number;
  end: number;
}

export interface GapOffer {
  customer: Customer;
  /** Who receives the message (the holder, for someone they manage). */
  to: Customer;
  start: number;
  /** Days past their usual return (negative = due in a few days). */
  lateByDays: number;
  member: boolean;
  /** What a visit of theirs is usually worth, paid per visit (0 for members). */
  visitCents: number;
}

export interface BarberGaps {
  barber: Barber;
  day: string;
  freeMinutes: number;
  windows: GapWindow[];
  offers: GapOffer[];
}

const SERVICE_MIN = 40;
const MAX_OFFERS = 4;

const gapCache = new WeakMap<Snapshot, Map<string, BarberGaps[]>>();

export function gapsFor(s: Snapshot, day: string = addDays(dayKey(s.now), 1)): BarberGaps[] {
  const cache = gapCache.get(s) ?? gapCache.set(s, new Map()).get(s)!;
  if (!cache.has(day)) cache.set(day, computeGaps(s, day));
  return cache.get(day)!;
}

function computeGaps(s: Snapshot, day: string): BarberGaps[] {
  const today = dayKey(s.now);
  const nowMin = day === today ? localParts(s.now).minutes : null;
  const busy = busyMapOf(s, day, day);
  const stats = visitStats(s);
  const customers = new Map(s.customers.map((c) => [c.id, c]));
  const members = new Set(s.subscriptions.filter((x) => x.status === "active" || x.status === "past_due").map((x) => x.customerId));
  const weekday = weekdayOf(day);
  const out: BarberGaps[] = [];

  for (const barber of s.barbers.filter((b) => b.active)) {
    const unit = s.units.find((u) => u.id === barber.unitId);
    const hours = unit?.hours[weekday] ?? null;
    if (!hours) continue;
    const starts = freeSlots(hours, busy[barber.id]?.[day], SERVICE_MIN, nowMin);
    const windows: GapWindow[] = [];
    for (const t of starts) {
      const last = windows.at(-1);
      if (last && t <= last.end) last.end = t + SERVICE_MIN;
      else windows.push({ start: t, end: t + SERVICE_MIN });
    }
    const freeMinutes = windows.reduce((t, w) => t + (w.end - w.start), 0);
    if (!windows.length) continue;

    const offers: GapOffer[] = [];
    for (const st of stats.values()) {
      if (st.mainBarberId !== barber.id || st.next || st.visits < 2) continue;
      const customer = customers.get(st.customerId);
      if (!customer) continue;
      const due = expectedReturn(st, customer.cycleDays);
      if (!due || due > addDays(day, 3)) continue;
      const habit = customerHabit(s, customer.id);
      const usual = habit?.minute ?? 16 * 60;
      if (habit?.weekday !== null && habit?.weekday !== undefined && habit.weekday !== weekday && Math.abs(habit.weekday - weekday) > 1) continue;
      const start = starts.filter((t) => Math.abs(t - usual) <= 90).sort((a, b) => Math.abs(a - usual) - Math.abs(b - usual))[0];
      if (start === undefined) continue;
      const member = members.has(customer.id);
      offers.push({
        customer,
        to: (customer.holderId ? customers.get(customer.holderId) : null) ?? customer,
        start,
        lateByDays: st.daysSinceLast !== null && st.avgGapDays !== null ? st.daysSinceLast - st.avgGapDays : 0,
        member,
        visitCents: member ? 0 : st.avgCoverableVisitCents,
      });
    }
    offers.sort((a, b) => b.lateByDays - a.lateByDays);
    // One customer per start time, so two people are never offered the same chair.
    const used = new Set<number>();
    const picked = offers.filter((o) => (used.has(o.start) ? false : (used.add(o.start), true))).slice(0, MAX_OFFERS);
    out.push({ barber, day, freeMinutes, windows, offers: picked });
  }
  return out.sort((a, b) => b.freeMinutes - a.freeMinutes);
}
