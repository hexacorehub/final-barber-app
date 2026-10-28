import { describe, expect, it } from "vitest";
import { assignBarbers, freeSlots } from "@/domain/availability";
import { checkAddMember, checkPlanRequest, household, referralCodeFor } from "@/domain/household";
import {
  barberRevenue,
  clubCharges,
  referralDiscounts,
  referralSummary,
  customerSummary,
  periodRange,
  planIndicators,
  retentionRisk,
  revenueMix,
  upsellCandidates,
} from "@/domain/metrics";
import { addDays, dayKey, fromLocal, localParts } from "@/domain/time";
import type { Snapshot, Subscription } from "@/domain/types";
import { buildDemoSnapshot, DEMO_CUSTOMER_ID, DEMO_DEPENDENT_ID, DEMO_FATHER_IN_LAW_ID } from "@/server/data/demo-dataset";

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
      referredByCustomerId: null,
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
    expect(c.dependents.map((d) => d.customer.name)).toEqual(["Pedro Lima", "Antônio Ferraz"]);
    expect(c.daysSinceVisit).toBe(12);
    expect(c.nextSuggested).toBe(addDays(dayKey(NOW), 2));
  });
});

describe("household", () => {
  const s = buildDemoSnapshot(NOW);
  it("lists the holder first and one plan per person", () => {
    const h = household(s, DEMO_CUSTOMER_ID);
    expect(h.map((m) => m.customer.id)).toEqual([DEMO_CUSTOMER_ID, DEMO_DEPENDENT_ID, DEMO_FATHER_IN_LAW_ID]);
    expect(h[0].isHolder).toBe(true);
    expect(h.map((m) => m.plan?.id)).toEqual(["plan-cb-plus", "plan-haircut-plus", "plan-beard-plus"]);
    expect(household(s, DEMO_DEPENDENT_ID)[0].customer.id).toBe(DEMO_CUSTOMER_ID);
  });
  it("only lets the holder ask for plans, for people in the account, without duplicates", () => {
    expect(checkPlanRequest(s, DEMO_DEPENDENT_ID, DEMO_DEPENDENT_ID, "plan-cb-plus").ok).toBe(false);
    expect(checkPlanRequest(s, DEMO_CUSTOMER_ID, DEMO_DEPENDENT_ID, "plan-haircut-plus").ok).toBe(false);
    expect(checkPlanRequest(s, DEMO_CUSTOMER_ID, DEMO_DEPENDENT_ID, "plan-cb-plus")).toEqual({ ok: true, kind: "upgrade" });
    expect(checkPlanRequest(s, DEMO_CUSTOMER_ID, "cust-0001", "plan-cb-plus").ok).toBe(false);
    expect(checkAddMember(s, DEMO_CUSTOMER_ID, "pedro lima").ok).toBe(false);
    expect(checkAddMember(s, DEMO_DEPENDENT_ID, "Ana").ok).toBe(false);
    expect(checkAddMember(s, DEMO_CUSTOMER_ID, "Ana Lima").ok).toBe(true);
  });
  it("makes readable referral codes", () => {
    expect(referralCodeFor("Antônio Ferraz", 7023)).toBe("ANTONIO-7023");
  });
});

describe("referral program", () => {
  const s = buildDemoSnapshot(NOW);
  it("gives the demo customer 50% off his next fee", () => {
    const r = referralSummary(s, DEMO_CUSTOMER_ID)!;
    expect(r.joined.length).toBe(1);
    expect(r.pending.length).toBe(1);
    expect(r.next?.day).toBe("2026-11-05");
    expect(r.next?.discountCents).toBe(Math.round(24999 * 0.5));
  });
  it("applies each credit once, after the friend joined", () => {
    const sub = (id: string, customerId: string, startedAt: string, referredBy: string | null): Subscription => ({
      id,
      customerId,
      payerCustomerId: customerId,
      planId: "plan-haircut-plus",
      status: "active",
      startedAt,
      canceledAt: null,
      billingDay: 10,
      soldByBarberId: null,
      channel: "app",
      referredByCustomerId: referredBy,
    });
    const base = tinySnapshot([]);
    const a = base.customers[0].id;
    const snap: Snapshot = {
      ...base,
      // Three separate accounts: referring someone of your own account does not count.
      customers: base.customers.map((c) => ({ ...c, holderId: null, relationship: null })),
      subscriptions: [
        sub("ref", a, "2026-01-02T12:00:00Z", null),
        sub("f1", base.customers[1].id, "2026-09-12T12:00:00Z", a),
        sub("f2", base.customers[2].id, "2026-09-20T12:00:00Z", a),
      ],
    };
    const d = referralDiscounts(snap).get("ref")!;
    expect([...d.keys()]).toEqual(["2026-10-10", "2026-11-10"]);
    const oct = clubCharges(snap, { from: "2026-10-01", to: "2026-10-20" }).find((c) => c.subscriptionId === "ref")!;
    expect(oct.amountCents).toBe(14999 - 7500);
  });
});
