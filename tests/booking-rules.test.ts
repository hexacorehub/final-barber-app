import { describe, expect, it } from "vitest";
import { type BookingCheck, availableStarts, decideBooking, previewChange, selectedUnit, selectionIssues } from "@/domain/booking-rules";

const H = { open: 9 * 60, close: 12 * 60 };
const HOURS = [null, H, H, H, H, H, H];
const units = [
  { id: "A", hours: HOURS, barberIds: ["a1", "a2"] },
  { id: "B", hours: HOURS, barberIds: ["b1"] },
];
const barbers = [
  { id: "a1", name: "Ana", unitId: "A" },
  { id: "a2", name: "Aldo", unitId: "A" },
  { id: "b1", name: "Bia", unitId: "B" },
];
const base: BookingCheck = {
  sel: { mode: "branch", unitId: "A", barberId: null },
  customerIds: ["c1"],
  day: "2026-10-22",
  weekday: 4,
  start: 600,
  durationMin: 40,
  units,
  barbers,
  busy: {},
  existing: [],
  nowMinutes: null,
};

describe("selection models", () => {
  it("resolves the unit from the branch or from the professional", () => {
    expect(selectedUnit({ mode: "branch", unitId: "A", barberId: null }, barbers)).toBe("A");
    expect(selectedUnit({ mode: "professional", unitId: "A", barberId: "b1" }, barbers)).toBe("B");
    expect(selectedUnit({ mode: "branch", unitId: null, barberId: null }, barbers)).toBeNull();
  });

  it("requires a professional when booking by professional", () => {
    expect(selectionIssues({ mode: "professional", unitId: null, barberId: null }, barbers)).toEqual([{ code: "missing_barber" }]);
    expect(availableStarts({ ...base, sel: { mode: "professional", unitId: null, barberId: null } })).toEqual([]);
  });

  it("rejects a professional from another unit when booking by unit", () => {
    const d = decideBooking({ ...base, sel: { mode: "branch", unitId: "A", barberId: "b1" } });
    expect(d).toEqual({ ok: false, issues: [{ code: "barber_other_unit", barberId: "b1", barberUnitId: "B", unitId: "A" }] });
  });

  it("books by professional at that professional's unit", () => {
    expect(decideBooking({ ...base, sel: { mode: "professional", unitId: "A", barberId: "b1" } })).toEqual({ ok: true, unitId: "B", barberIds: ["b1"] });
  });

  it("books by unit with any free professional there, never in the other unit", () => {
    const busy = { a1: { "2026-10-22": [[600, 640]] as [number, number][] } };
    expect(decideBooking({ ...base, busy })).toEqual({ ok: true, unitId: "A", barberIds: ["a2"] });
    const allBusy = { a1: busy.a1, a2: busy.a1 };
    expect(decideBooking({ ...base, busy: allBusy })).toEqual({ ok: false, issues: [{ code: "slot_unavailable" }] });
    expect(decideBooking({ ...base, busy: allBusy, sel: { mode: "branch", unitId: null, barberId: null } })).toEqual({ ok: true, unitId: "B", barberIds: ["b1"] });
  });

  it("seats a group side by side in one unit only", () => {
    expect(decideBooking({ ...base, customerIds: ["c1", "c2"] })).toEqual({ ok: true, unitId: "A", barberIds: ["a1", "a2"] });
    expect(decideBooking({ ...base, customerIds: ["c1", "c2"], sel: { mode: "branch", unitId: "B", barberId: null } }).ok).toBe(false);
    expect(decideBooking({ ...base, customerIds: ["c1", "c2"], sel: { mode: "professional", unitId: null, barberId: "a2" } })).toEqual({
      ok: true,
      unitId: "A",
      barberIds: ["a2", "a1"],
    });
  });

  it("never double books a person, even at another unit", () => {
    const existing = [{ customerId: "c1", day: "2026-10-22", start: 610, end: 650, unitId: "B" }];
    const d = decideBooking({ ...base, existing });
    expect(d).toEqual({ ok: false, issues: [{ code: "person_busy", customerId: "c1", unitId: "B", start: 610 }] });
    expect(availableStarts({ ...base, existing })).not.toContain(600);
    expect(availableStarts({ ...base, existing })).toContain(660);
  });
});

describe("changing the choice", () => {
  const ctx = { ...base, start: 600 as number | null };

  it("drops a professional who does not work at the new unit", () => {
    const c = previewChange({ mode: "branch", unitId: "A", barberId: "a1" }, { mode: "branch", unitId: "B", barberId: "a1" }, ctx);
    expect(c.dropsBarber).toBe("a1");
    expect(c.next).toEqual({ mode: "branch", unitId: "B", barberId: null });
    expect(c.unitChanged).toEqual({ from: "A", to: "B" });
    expect(c.dropsTime).toBe(false);
  });

  it("keeps the time when it still works and flags it when it does not", () => {
    const busyB = { b1: { "2026-10-22": [[600, 640]] as [number, number][] } };
    const c = previewChange({ mode: "professional", unitId: null, barberId: "a1" }, { mode: "professional", unitId: null, barberId: "b1" }, { ...ctx, busy: busyB });
    expect(c.dropsTime).toBe(true);
    expect(c.unitChanged).toEqual({ from: "A", to: "B" });
    const ok = previewChange({ mode: "professional", unitId: null, barberId: "a1" }, { mode: "professional", unitId: null, barberId: "a2" }, ctx);
    expect(ok).toMatchObject({ dropsTime: false, dropsBarber: null, unitChanged: null });
  });

  it("keeps a professional who is in the new unit when switching mode", () => {
    const c = previewChange({ mode: "professional", unitId: null, barberId: "b1" }, { mode: "branch", unitId: "B", barberId: "b1" }, ctx);
    expect(c).toMatchObject({ dropsBarber: null, unitChanged: null, next: { mode: "branch", unitId: "B", barberId: "b1" } });
  });
});
