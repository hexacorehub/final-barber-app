import { describe, expect, it } from "vitest";
import { customerHabit, nextUsualBooking, usualStart } from "@/domain/assistants/habits";
import { gapsFor } from "@/domain/assistants/gap-fill";
import { outboxToday } from "@/domain/assistants/outbox";
import { addDays, dayKey, weekdayOf } from "@/domain/time";
import { buildDemoSnapshot, DEMO_CUSTOMER_ID, DEMO_DEPENDENT_ID } from "@/server/data/demo-dataset";

const s = buildDemoSnapshot(new Date("2026-10-27T15:00:00Z"));

describe("habits", () => {
  it("reads the usual day, time, barber, services and who comes along", () => {
    const h = customerHabit(s, DEMO_CUSTOMER_ID)!;
    expect(h.minute).toBe(16 * 60);
    expect(h.barberId).toBe("barber-bigode");
    expect(h.serviceIds).toEqual(["svc-haircut", "svc-beard"]);
    expect(h.companions).toContain(DEMO_DEPENDENT_ID);
    expect(h.rhythmDays).toBe(14);
  });

  it("picks the free time closest to the usual one, within 90 minutes", () => {
    expect(usualStart(960, [900, 990, 1020])).toBe(990);
    expect(usualStart(960, [720, 1140])).toBeNull();
  });

  it("books 'o de sempre' with the usual barber, on the due day or later, and only companions with the same services", () => {
    const u = nextUsualBooking(s, DEMO_CUSTOMER_ID)!;
    expect(u.barberId).toBe("barber-bigode");
    expect(u.day >= u.habit.dueOn || u.day >= dayKey(s.now)).toBe(true);
    for (const id of u.customerIds.slice(1)) expect(customerHabit(s, id)!.serviceIds).toEqual(u.habit.serviceIds);
  });
});

describe("gap fill", () => {
  const tomorrow = addDays(dayKey(s.now), 1);
  const gaps = gapsFor(s, tomorrow);

  it("offers each free time to one customer of that barber, with nothing booked", () => {
    expect(gaps.length).toBeGreaterThan(0);
    for (const g of gaps) {
      const starts = g.offers.map((o) => o.start);
      expect(new Set(starts).size).toBe(starts.length);
      for (const o of g.offers) {
        expect(g.windows.some((w) => o.start >= w.start && o.start < w.end)).toBe(true);
        expect(s.appointments.some((a) => a.customerId === o.customer.id && a.status === "scheduled" && a.startsAt >= s.now)).toBe(false);
      }
    }
    expect(weekdayOf(tomorrow)).toBeGreaterThanOrEqual(0);
  });

  it("goes to the WhatsApp queue, capped", () => {
    const n = outboxToday(s).filter((i) => i.situation === "gap_offer").length;
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThanOrEqual(10);
  });
});
