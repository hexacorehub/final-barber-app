import "server-only";
import { busyMapOf, type BookingUnit, type BusyMap } from "@/domain/availability";
import type { PersonBooking } from "@/domain/booking-rules";
import { addDays, dayKey, localParts } from "@/domain/time";
import { household } from "@/domain/household";
import type { Plan, Relationship, Snapshot, Subscription } from "@/domain/types";
export { priceFor } from "@/domain/pricing";

export const BOOKING_DAYS = 8;

/** Busy intervals of every active barber over the booking window. */
export function busyMap(s: Snapshot): BusyMap {
  const today = dayKey(s.now);
  return busyMapOf(s, today, addDays(today, BOOKING_DAYS));
}

/** Upcoming appointments of the given people, to avoid booking someone twice at once. */
export function personBookings(s: Snapshot, customerIds: string[]): PersonBooking[] {
  const today = dayKey(s.now);
  const ids = new Set(customerIds);
  return s.appointments
    .filter((a) => ids.has(a.customerId) && a.status === "scheduled" && dayKey(a.startsAt) >= today)
    .map((a) => {
      const start = localParts(a.startsAt).minutes;
      return { customerId: a.customerId, day: dayKey(a.startsAt), start, end: start + a.durationMin, unitId: a.unitId };
    });
}

export function bookingUnits(s: Snapshot): BookingUnit[] {
  return s.units.map((u) => ({
    id: u.id,
    hours: u.hours,
    barberIds: s.barbers.filter((b) => b.active && b.unitId === u.id).map((b) => b.id),
  }));
}

/**
 * People the signed-in customer can book for: the holder books for everyone in the account;
 * a managed member only for themselves. Each comes with the plan in force (active or past due).
 */
export function bookablePeople(s: Snapshot, customerId: string): { id: string; name: string; isSelf: boolean; relationship: Relationship | null; subscription: Subscription | null; plan: Plan | null }[] {
  const me = s.customers.find((c) => c.id === customerId);
  if (!me) return [];
  const members = me.holderId ? household(s, customerId).filter((m) => m.customer.id === customerId) : household(s, customerId);
  return members.map((m) => {
    const inForce = m.subscription && (m.subscription.status === "active" || m.subscription.status === "past_due");
    return {
      id: m.customer.id,
      name: m.customer.name,
      isSelf: m.customer.id === customerId,
      relationship: m.customer.relationship,
      subscription: inForce ? m.subscription : null,
      plan: inForce ? m.plan : null,
    };
  });
}
