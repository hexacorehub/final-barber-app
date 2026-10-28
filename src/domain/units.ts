import type { Snapshot } from "./types";
import { barberRevenue, inRange, revenueMix } from "./metrics";

/**
 * A snapshot seen from one unit: its barbers, visits and product sales. Club subscriptions
 * belong to the unit that charges them (`billingUnitId`); without one they stay shop-wide.
 * Every metric works the same on a scoped snapshot, so filtering by unit needs no special code.
 */
export function scopeToUnit(s: Snapshot, unitId: string | null): Snapshot {
  if (!unitId || !s.units.some((u) => u.id === unitId)) return s;
  return {
    ...s,
    barbers: s.barbers.filter((b) => b.unitId === unitId),
    appointments: s.appointments.filter((a) => a.unitId === unitId),
    productSales: s.productSales.filter((x) => x.unitId === unitId),
    subscriptions: s.subscriptions.filter((x) => !x.billingUnitId || x.billingUnitId === unitId),
    scopedFrom: s.scopedFrom ?? s,
  };
}

export interface UnitNumbers {
  unit: Snapshot["units"][number];
  revenueCents: number;
  walkInCents: number;
  clubCents: number;
  productCents: number;
  completed: number;
  occupancy: number;
  /** Plans charged by this unit (active), and their monthly total. */
  members: number;
  mrrCents: number;
  /** Visits by members whose plan is charged by the other unit (only informative). */
  crossVisits: number;
}

/** The same numbers for each unit side by side. */
export function unitBreakdown(s: Snapshot, r: { from: string; to: string }): UnitNumbers[] {
  const prices = new Map(s.plans.map((p) => [p.id, p.priceCents]));
  const billing = new Map(s.subscriptions.map((x) => [x.id, x.billingUnitId ?? null]));
  return s.units.map((unit) => {
    const scoped = scopeToUnit(s, unit.id);
    const mix = revenueMix(scoped, r);
    const barbers = barberRevenue(scoped, r);
    const subs = s.subscriptions.filter((x) => x.status === "active" && x.billingUnitId === unit.id);
    const crossVisits = scoped.appointments.filter((a) => a.status === "completed" && a.subscriptionId && billing.get(a.subscriptionId) && billing.get(a.subscriptionId) !== unit.id && inRange(a.startsAt, r)).length;
    return {
      unit,
      revenueCents: mix.totalCents,
      walkInCents: mix.walkInCents,
      clubCents: mix.clubCents,
      productCents: mix.productCents,
      completed: mix.completed,
      occupancy: barbers.length ? barbers.reduce((t, b) => t + b.occupancy, 0) / barbers.length : 0,
      members: subs.length,
      mrrCents: subs.reduce((t, x) => t + (prices.get(x.planId) ?? 0), 0),
      crossVisits,
    };
  });
}
