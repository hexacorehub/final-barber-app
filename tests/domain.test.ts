import { describe, expect, it } from "vitest";
import { assignBarbers, freeSlots } from "@/domain/availability";
import {
  barberRevenue,
  clubCharges,
  customerSummary,
  periodRange,
  planIndicators,
  quotePlans,
  retentionRisk,
  revenueMix,
  upsellCandidates,
} from "@/domain/metrics";
import { addDays, dayKey, fromLocal, localParts } from "@/domain/time";
import type { Snapshot, Subscription } from "@/domain/types";
import { PLANS } from "@/server/data/catalog";
import { buildDemoSnapshot, DEMO_CUSTOMER_ID } from "@/server/data/demo-dataset";

const NOW = new Date("2026-10-20T20:30:00Z"); // 17:30 in São Paulo, a Tuesday

describe("time", () => {
  it("uses São Paulo wall time regardless of the server timezone", () => {
    expect(dayKey("2026-10-21T02:00:00Z")).toBe("2026-10-20");
    expect(localParts(NOW).minutes).toBe(17 * 60 + 30);
    expect(fromLocal("2026-10-20", 9 * 60).toISOString()).toBe("2026-10-20T12:00:00.000Z");
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
  });
});

describe("availability", () => {
  const hours = { open: 9 * 60, close: 12 * 60 };
  it("lists slots that fit and skips busy and past times", () => {
    expect(freeSlots(hours, [[600, 660]], 40, null)).toEqual([540, 660]);
    expect(freeSlots(hours, [], 40, 600)).toEqual([630, 660]);
    expect(freeSlots(null, [], 40, null)).toEqual([]);
  });
  it("assigns distinct free barbers, preferred first", () => {
    const busy = { a: { d: [[540, 600]] as [number, number][] } };
    expect(assignBarbers(["a", "b", "c"], busy, "d", 540, 40, 2, null)).toEqual(["b", "c"]);
    expect(assignBarbers(["a", "b", "c"], busy, "d", 600, 40, 2, "c")).toEqual(["c", "a"]);
    expect(assignBarbers(["a", "b"], busy, "d", 540, 40, 2, null)).toBeNull();
    expect(assignBarbers(["a", "b"], busy, "d", 540, 40, 1, "a")).toBeNull();
  });
});

describe("plan quotes", () => {
  it("picks the cheapest plan covering what the customer uses", () => {
    const q = quotePlans(PLANS, 8000, 6500, 3, 0);
    expect(q.perVisitCents).toBe(24000);
    expect(q.best?.plan.id).toBe("plan-haircut-plus");
    expect(q.best?.savingCents).toBe(24000 - 14999);
    expect(quotePlans(PLANS, 8000, 6500, 2, 2).best?.plan.id).toBe("plan-cb-plus");
    expect(quotePlans(PLANS, 8000, 6500, 0, 0).best).toBeNull();
  });
});

function tinySnapshot(subs: Partial<Subscription>[]): Snapshot {
  const base = buildDemoSnapshot(NOW);
  return {
    ...base,
    customers: base.customers.slice(0, 3),
    appointments: [],
    productSales: [],
    subscriptions: subs.map((x, i) => ({
      id: `s${i}`,
      customerId: base.customers[i].id,
      payerCustomerId: base.customers[i].id,
      planId: "plan-haircut-plus",
      status: "active",
      startedAt: "2026-01-10T12:00:00Z",
      canceledAt: null,
      billingDay: 10,
      soldByBarberId: null,
      channel: "counter",
      ...x,
    })),
  };
}

describe("club charges", () => {
  it("charges each billing day while in force and skips the failed one", () => {
    const s = tinySnapshot([{}, { status: "past_due" }, { canceledAt: "2026-09-15T12:00:00Z", status: "canceled" }]);
    const sep = clubCharges(s, { from: "2026-09-01", to: "2026-09-30" });
    expect(sep).toHaveLength(3);
    const oct = clubCharges(s, { from: "2026-10-01", to: "2026-10-20" });
    expect(oct.map((c) => c.subscriptionId)).toEqual(["s0"]);
  });
  it("computes churn per plan", () => {
    const s = tinySnapshot([{}, { canceledAt: "2026-10-05T12:00:00Z", status: "canceled" }]);
    const ind = planIndicators(s, periodRange("mes", NOW)).find((p) => p.plan.id === "plan-haircut-plus")!;
    expect(ind.members).toBe(1);
    expect(ind.canceledInRange).toBe(1);
    expect(ind.churn).toBe(0.5);
  });
});

describe("demo data dashboards", () => {
  const s = buildDemoSnapshot(NOW);
  const month = periodRange("mes", NOW);

  it("splits the revenue mix and the barber revenue consistently", () => {
    const mix = revenueMix(s, month);
    const barbers = barberRevenue(s, month, { includeInactive: true });
    const walkIn = barbers.reduce((t, b) => t + b.walkInCents, 0);
    const club = barbers.reduce((t, b) => t + b.clubShareCents, 0);
    expect(walkIn).toBe(mix.walkInCents);
    expect(Math.abs(club - mix.clubCents)).toBeLessThan(barbers.length);
    expect(barbers.every((b) => b.occupancy >= 0 && b.occupancy <= 1)).toBe(true);
  });

  it("only lists active barbers by default", () => {
    expect(barberRevenue(s, month).every((b) => b.barber.active)).toBe(true);
  });

  it("finds customers who would save with a plan", () => {
    const list = upsellCandidates(s);
    expect(list.length).toBeGreaterThan(0);
    expect(list.every((c) => c.monthlySavingCents > 0)).toBe(true);
  });

  it("flags at-risk members", () => {
    const risk = retentionRisk(s);
    expect(risk.some((r) => r.reason === "past_due")).toBe(true);
    expect(risk.some((r) => r.reason === "late")).toBe(true);
  });

  it("summarizes the demo customer", () => {
    const c = customerSummary(s, DEMO_CUSTOMER_ID)!;
    expect(c.plan?.id).toBe("plan-cb-plus");
    expect(c.dependents.map((d) => d.customer.name)).toEqual(["Pedro Lima"]);
    expect(c.daysSinceVisit).toBe(12);
    expect(c.nextSuggested).toBe(addDays(dayKey(NOW), 2));
  });
});
