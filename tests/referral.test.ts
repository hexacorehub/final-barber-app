import { describe, expect, it } from "vitest";
import { referralCredits, referralDiscounts, referralSummary, referralTarget } from "@/domain/metrics";
import { referralRulesText } from "@/domain/referral-rules";
import type { Customer, Snapshot, Subscription } from "@/domain/types";
import { buildDemoSnapshot } from "@/server/data/demo-dataset";

const NOW = new Date("2026-10-20T20:30:00Z");
const demo = buildDemoSnapshot(NOW);

const person = (id: string, holderId: string | null = null): Customer => ({
  id,
  name: `Pessoa ${id}`,
  phone: "(11) 90000-0000",
  cycleDays: 21,
  preferredBarberId: null,
  createdAt: "2025-01-01T12:00:00Z",
  holderId,
  relationship: holderId ? "child" : null,
  minor: false,
  referralCode: id.toUpperCase(),
});

const sub = (id: string, customerId: string, startedAt: string, extra: Partial<Subscription> = {}): Subscription => ({
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
  referredByCustomerId: null,
  ...extra,
});

function snap(customers: Customer[], subscriptions: Subscription[], rules?: Snapshot["shop"]["referralRules"]): Snapshot {
  return { ...demo, shop: { ...demo.shop, referralRules: rules ?? null }, customers, subscriptions, appointments: [], productSales: [], leads: [] };
}

describe("referral rules", () => {
  it("uses at most one credit per monthly fee: two friends = two months", () => {
    const s = snap(
      [person("a"), person("f1"), person("f2")],
      [sub("ref", "a", "2026-01-02T12:00:00Z"), sub("x1", "f1", "2026-09-12T12:00:00Z", { referredByCustomerId: "a" }), sub("x2", "f2", "2026-09-13T12:00:00Z", { referredByCustomerId: "a" })],
    );
    expect([...referralDiscounts(s).get("ref")!.entries()]).toEqual([
      ["2026-10-10", 7500],
      ["2026-11-10", 7500],
    ]);
  });

  it("waits for the friend's first fee when it failed", () => {
    const s = snap([person("a"), person("f1")], [sub("ref", "a", "2026-01-02T12:00:00Z"), sub("x1", "f1", "2026-10-15T12:00:00Z", { referredByCustomerId: "a", status: "past_due" })]);
    expect(referralCredits(s)[0].status).toBe("awaiting_payment");
    expect(referralDiscounts(s).get("ref")).toBeUndefined();
  });

  it("keeps at most maxQueued credits in line", () => {
    const friends = Array.from({ length: 4 }, (_, i) => person(`f${i}`));
    const s = snap(
      [person("a"), ...friends],
      [sub("ref", "a", "2026-01-02T12:00:00Z"), ...friends.map((f, i) => sub(`x${i}`, f.id, `2026-10-0${i + 1}T12:00:00Z`, { referredByCustomerId: "a" }))],
      { maxQueued: 2 },
    );
    const statuses = referralCredits(s).map((c) => c.status).sort();
    // Born 1–4 Oct, next fee on the 10th: the 3rd and 4th find the line full.
    expect(statuses.filter((x) => x === "over_limit").length).toBe(2);
  });

  it("expires credits that wait too long", () => {
    // Five friends in early July, one credit per fee, valid for 2 months: three expire on 1–5 Sep.
    const friends = Array.from({ length: 5 }, (_, i) => person(`f${i}`));
    const s = snap(
      [person("a"), ...friends],
      [sub("ref", "a", "2026-01-02T12:00:00Z"), ...friends.map((f, i) => sub(`x${i}`, f.id, `2026-07-0${i + 1}T12:00:00Z`, { referredByCustomerId: "a" }))],
      { expiryMonths: 2 },
    );
    const c = referralCredits(s);
    expect(c.filter((x) => x.status === "applied").length).toBe(2);
    expect(c.filter((x) => x.status === "expired").length).toBe(3);
  });

  it("gives the discount to the holder's own plan, else the most expensive plan they pay — never to every plan", () => {
    const holder = person("h");
    const kid = person("k", "h");
    const spouse = person("w", "h");
    const friend = person("f");
    const subs = [
      sub("kid", "k", "2026-01-02T12:00:00Z", { payerCustomerId: "h", planId: "plan-haircut-plus" }),
      sub("wife", "w", "2026-01-02T12:00:00Z", { payerCustomerId: "h", planId: "plan-cb-premium" }),
      sub("x", "f", "2026-09-12T12:00:00Z", { referredByCustomerId: "h" }),
    ];
    const s = snap([holder, kid, spouse, friend], subs);
    expect(referralTarget(s, "h")!.id).toBe("wife");
    const d = referralDiscounts(s);
    expect(d.get("wife")?.size).toBe(1);
    expect(d.get("kid")).toBeUndefined();
  });

  it("a referral made by someone in an account goes to the holder; inside the account it does not count", () => {
    const s = snap(
      [person("h"), person("k", "h"), person("f"), person("k2", "h")],
      [
        sub("own", "h", "2026-01-02T12:00:00Z"),
        sub("x", "f", "2026-09-12T12:00:00Z", { referredByCustomerId: "k" }),
        sub("y", "k2", "2026-09-12T12:00:00Z", { referredByCustomerId: "h", payerCustomerId: "h" }),
      ],
    );
    const credits = referralCredits(s);
    expect(credits.length).toBe(1);
    expect(credits[0].beneficiaryId).toBe("h");
  });

  it("the demo customer still gets his next discount and sees the rules", () => {
    const r = referralSummary(demo, "cust-rafael") ?? referralSummary(demo, demo.customers[0].id)!;
    expect(r.canRefer).toBe(true);
    expect(r.next?.discountCents).toBe(Math.round(24999 * 0.5));
    expect(referralRulesText(r.rules).join(" ")).toContain("No máximo um desconto por mês");
  });
});
