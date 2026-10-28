import { describe, expect, it } from "vitest";
import { bySeller, filterRows, subscriptionRows, summarizeRows, winBackList, winBackScore } from "@/domain/assistants/subscriptions";
import { outboxToday } from "@/domain/assistants/outbox";
import { ownerDay } from "@/domain/assistants/owner-actions";
import { buildDemoSnapshot } from "@/server/data/demo-dataset";

const s = buildDemoSnapshot(new Date("2026-10-27T15:00:00Z"));
const rows = subscriptionRows(s);

describe("subscription tracking", () => {
  it("has one row per subscription with its seller, referrer and status", () => {
    expect(rows.length).toBe(s.subscriptions.length);
    expect(rows.some((r) => r.status === "canceled")).toBe(true);
    expect(rows.some((r) => r.referrer)).toBe(true);
    expect(rows.some((r) => !r.seller)).toBe(true);
  });

  it("filters by seller, no seller, referral, status and channel", () => {
    const seller = rows.find((r) => r.seller)!.seller!.id;
    expect(filterRows(rows, { seller }, s.now).every((r) => r.sub.soldByBarberId === seller)).toBe(true);
    expect(filterRows(rows, { seller: "none" }, s.now).every((r) => !r.seller)).toBe(true);
    expect(filterRows(rows, { referral: "with" }, s.now).every((r) => r.referrer)).toBe(true);
    expect(filterRows(rows, { referral: "without" }, s.now).every((r) => !r.referrer)).toBe(true);
    expect(filterRows(rows, { status: "canceled" }, s.now).every((r) => r.status === "canceled")).toBe(true);
    expect(filterRows(rows, { channel: "app" }, s.now).every((r) => r.sub.channel === "app")).toBe(true);
    const withAndWithout = filterRows(rows, { referral: "with" }, s.now).length + filterRows(rows, { referral: "without" }, s.now).length;
    expect(withAndWithout).toBe(rows.length);
  });

  it("the breakdown by seller covers everyone, including 'sem barbeiro'", () => {
    const by = bySeller(rows, s.barbers);
    expect(by.reduce((t, x) => t + x.current + x.canceled, 0)).toBe(rows.length);
    expect(by.some((x) => x.id === "none")).toBe(true);
  });

  it("summarizes the selection", () => {
    const sum = summarizeRows(rows);
    expect(sum.current + sum.canceled).toBe(sum.count);
    expect(sum.mrrCents).toBe(rows.filter((r) => r.sub.status === "active").reduce((t, r) => t + r.plan.priceCents, 0));
  });
});

describe("win-back", () => {
  it("prefers recent cancellations of long-time members who still come", () => {
    expect(winBackScore(10, 2, 8).chance).toBe("alta");
    expect(winBackScore(170, 0, 1).chance).toBe("baixa");
  });

  it("lists only former members without a current plan", () => {
    const list = winBackList(rows);
    const current = new Set(s.subscriptions.filter((x) => x.status !== "canceled").map((x) => x.customerId));
    expect(list.length).toBeGreaterThan(0);
    for (const r of list) {
      expect(r.status).toBe("canceled");
      expect(current.has(r.customer.id)).toBe(false);
    }
  });

  it("feeds the WhatsApp queue (capped) and the owner's day", () => {
    expect(outboxToday(s).filter((i) => i.situation === "win_back").length).toBeLessThanOrEqual(3);
    const high = winBackList(rows).filter((r) => r.winBack?.chance === "alta").length;
    expect(ownerDay(s).actions.filter((a) => a.kind === "win_back").length).toBe(high);
  });
});
