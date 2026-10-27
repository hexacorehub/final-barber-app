import type { Snapshot } from "./types";

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
  };
}
