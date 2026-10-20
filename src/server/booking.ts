import "server-only";
import type { BookingUnit, BusyMap } from "@/domain/availability";
import { addDays, dayKey, localParts } from "@/domain/time";
import type { Plan, Snapshot, Subscription } from "@/domain/types";
export { priceFor } from "@/domain/pricing";

export const BOOKING_DAYS = 8;

/** Busy intervals of every active barber over the booking window. */
export function busyMap(s: Snapshot): BusyMap {
  const today = dayKey(s.now);
  const last = addDays(today, BOOKING_DAYS);
  const out: BusyMap = {};
  for (const a of s.appointments) {
    if (a.status === "canceled") continue;
    const day = dayKey(a.startsAt);
    if (day < today || day > last) continue;
    const start = localParts(a.startsAt).minutes;
    ((out[a.barberId] ??= {})[day] ??= []).push([start, start + a.durationMin]);
  }
  return out;
}

export function bookingUnits(s: Snapshot): BookingUnit[] {
  return s.units.map((u) => ({
    id: u.id,
    hours: u.hours,
    barberIds: s.barbers.filter((b) => b.active && b.unitId === u.id).map((b) => b.id),
  }));
}

/** Customers the signed-in customer can book for: himself and his dependents, with their plans. */
export function bookablePeople(s: Snapshot, customerId: string): { id: string; name: string; isSelf: boolean; subscription: Subscription | null; plan: Plan | null }[] {
  const plans = new Map(s.plans.map((p) => [p.id, p]));
  const inForce = (x: Subscription) => x.status === "active" || x.status === "past_due";
  const me = s.customers.find((c) => c.id === customerId);
  if (!me) return [];
  const mySub = s.subscriptions.find((x) => x.customerId === customerId && inForce(x)) ?? null;
  const dependents = s.subscriptions
    .filter((x) => x.payerCustomerId === customerId && x.customerId !== customerId && x.status !== "canceled")
    .map((x) => ({ sub: x, customer: s.customers.find((c) => c.id === x.customerId) }))
    .filter((x) => x.customer);
  return [
    { id: me.id, name: me.name, isSelf: true, subscription: mySub, plan: mySub ? (plans.get(mySub.planId) ?? null) : null },
    ...dependents.map(({ sub, customer }) => ({
      id: customer!.id,
      name: customer!.name,
      isSelf: false,
      subscription: inForce(sub) ? sub : null,
      plan: inForce(sub) ? (plans.get(sub.planId) ?? null) : null,
    })),
  ];
}
