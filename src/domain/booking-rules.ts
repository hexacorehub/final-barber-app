import { type BookingUnit, type BusyMap, bookableStarts, planBooking } from "./availability";

/**
 * How the customer chooses where and with whom:
 * - "branch": pick a unit first; any free professional there, or one of that unit's.
 * - "professional": pick a person first; the unit is the one they work at.
 *
 * Professionals work at one unit, and a group booked together sits side by side in one unit.
 * Club plans are not tied to a unit in the current rules, so the unit never changes what is
 * covered or the price of a visit.
 */
export type BookingMode = "branch" | "professional";

export interface Selection {
  mode: BookingMode;
  /** Branch mode: chosen unit, null = any unit (first free slot). Ignored in professional mode. */
  unitId: string | null;
  /** Professional mode: required. Branch mode: optional, must work at the chosen unit. */
  barberId: string | null;
}

export interface BarberRef {
  id: string;
  name: string;
  unitId: string;
}

/** An appointment someone in the booking already has (to avoid double booking a person). */
export interface PersonBooking {
  customerId: string;
  day: string;
  start: number;
  end: number;
  unitId: string;
}

export type BookingIssue =
  | { code: "missing_barber" }
  | { code: "unknown_barber"; barberId: string }
  | { code: "barber_other_unit"; barberId: string; barberUnitId: string; unitId: string }
  | { code: "person_busy"; customerId: string; unitId: string; start: number }
  | { code: "slot_unavailable" };

/** The unit a selection points to (null = any unit, decided by availability). */
export function selectedUnit(sel: Selection, barbers: BarberRef[]): string | null {
  if (sel.mode === "professional") return barbers.find((b) => b.id === sel.barberId)?.unitId ?? null;
  return sel.unitId;
}

/** Problems with the where/who choice itself, before looking at a time. */
export function selectionIssues(sel: Selection, barbers: BarberRef[]): BookingIssue[] {
  if (sel.mode === "professional" && !sel.barberId) return [{ code: "missing_barber" }];
  if (!sel.barberId) return [];
  const barber = barbers.find((b) => b.id === sel.barberId);
  if (!barber) return [{ code: "unknown_barber", barberId: sel.barberId }];
  if (sel.mode === "branch" && sel.unitId && barber.unitId !== sel.unitId) {
    return [{ code: "barber_other_unit", barberId: barber.id, barberUnitId: barber.unitId, unitId: sel.unitId }];
  }
  return [];
}

/** Appointments of the people being booked that overlap the requested time. */
export function personConflicts(existing: PersonBooking[], customerIds: string[], day: string, start: number, durationMin: number): PersonBooking[] {
  return existing.filter((b) => customerIds.includes(b.customerId) && b.day === day && start < b.end && start + durationMin > b.start);
}

export interface BookingCheck {
  sel: Selection;
  customerIds: string[];
  day: string;
  weekday: number;
  start: number;
  durationMin: number;
  units: BookingUnit[];
  barbers: BarberRef[];
  busy: BusyMap;
  existing: PersonBooking[];
  /** Minutes after midnight now, only when `day` is today. */
  nowMinutes: number | null;
}

export type BookingDecision = { ok: true; unitId: string; barberIds: string[] } | { ok: false; issues: BookingIssue[] };

/**
 * The authoritative check, run by the server before saving and by the screen before
 * enabling the confirm button: a valid where/who choice, nobody double booked, and one free
 * professional per person side by side in a single unit.
 */
export function decideBooking(c: BookingCheck): BookingDecision {
  const issues = selectionIssues(c.sel, c.barbers);
  if (issues.length) return { ok: false, issues };
  const conflicts = personConflicts(c.existing, c.customerIds, c.day, c.start, c.durationMin);
  if (conflicts.length) {
    return { ok: false, issues: conflicts.map((x) => ({ code: "person_busy" as const, customerId: x.customerId, unitId: x.unitId, start: x.start })) };
  }
  const plan = planBooking({
    units: c.units,
    unitId: selectedUnit(c.sel, c.barbers),
    barberId: c.sel.barberId,
    day: c.day,
    weekday: c.weekday,
    start: c.start,
    durationMin: c.durationMin,
    people: Math.max(1, c.customerIds.length),
    busy: c.busy,
    nowMinutes: c.nowMinutes,
  });
  return plan ? { ok: true, ...plan } : { ok: false, issues: [{ code: "slot_unavailable" }] };
}

/** Start times that pass `decideBooking` for this selection (used to list the slots). */
export function availableStarts(c: Omit<BookingCheck, "start">): number[] {
  if (selectionIssues(c.sel, c.barbers).length) return [];
  return bookableStarts({
    units: c.units,
    unitId: selectedUnit(c.sel, c.barbers),
    barberId: c.sel.barberId,
    day: c.day,
    weekday: c.weekday,
    durationMin: c.durationMin,
    people: Math.max(1, c.customerIds.length),
    busy: c.busy,
    nowMinutes: c.nowMinutes,
  }).filter((t) => personConflicts(c.existing, c.customerIds, c.day, t, c.durationMin).length === 0);
}

export interface SelectionChange {
  next: Selection;
  /** The professional chosen before is dropped (works at another unit). */
  dropsBarber: string | null;
  /** The chosen time no longer works with the new choice. */
  dropsTime: boolean;
  /** The unit the booking ends up in changed. */
  unitChanged: { from: string | null; to: string | null } | null;
}

/**
 * What switching to another unit, professional or mode does to the current choice, so the
 * screen can keep what still works and explain (and confirm) what does not.
 */
export function previewChange(current: Selection, next: Selection, ctx: Omit<BookingCheck, "sel" | "start"> & { start: number | null }): SelectionChange {
  let adjusted = next;
  let dropsBarber: string | null = null;
  if (adjusted.mode === "branch" && adjusted.barberId) {
    const barber = ctx.barbers.find((b) => b.id === adjusted.barberId);
    if (adjusted.unitId && barber && barber.unitId !== adjusted.unitId) {
      dropsBarber = barber.id;
      adjusted = { ...adjusted, barberId: null };
    }
  }
  const fromUnit = selectedUnit(current, ctx.barbers);
  const toUnit = selectedUnit(adjusted, ctx.barbers);
  const dropsTime =
    ctx.start !== null && !decideBooking({ ...ctx, sel: adjusted, start: ctx.start }).ok && decideBooking({ ...ctx, sel: current, start: ctx.start }).ok;
  return { next: adjusted, dropsBarber, dropsTime, unitChanged: fromUnit !== toUnit ? { from: fromUnit, to: toUnit } : null };
}
