import { describe, expect, it } from "vitest";
import { familyNotes, familyPlan } from "@/domain/assistants/family";
import { productLife, recommendationsFor, refillsFor, stockForecast } from "@/domain/assistants/shelf";
import { buildDemoSnapshot, DEMO_CUSTOMER_ID } from "@/server/data/demo-dataset";

const s = buildDemoSnapshot(new Date("2026-10-27T15:00:00Z"));

describe("family", () => {
  it("covers everyone in the account and totals the plan suggestion", () => {
    const f = familyPlan(s, DEMO_CUSTOMER_ID);
    expect(f.rows.length).toBe(3);
    expect(f.suggestedCents).toBe(f.rows.reduce((t, r) => t + r.suggestedCents, 0));
    for (const r of f.rows) expect(r.suggestedCents).toBeLessThanOrEqual(r.todayCents + 1);
  });

  it("notes are about people of the account", () => {
    const ids = new Set(familyPlan(s, DEMO_CUSTOMER_ID).rows.map((r) => r.customer.id));
    for (const n of familyNotes(s, DEMO_CUSTOMER_ID)) expect(ids.has(n.customer.id)).toBe(true);
  });
});

describe("shop window", () => {
  it("forecasts when stock runs out from the last 30 days of sales", () => {
    const f = stockForecast(s);
    expect(f.length).toBeGreaterThan(0);
    for (const x of f) if (x.daysLeft !== null) expect(x.daysLeft).toBe(Math.floor(x.product.stock / x.perDay));
  });

  it("learns how long a product lasts and suggests refills only after most of it", () => {
    const sale = s.productSales.find((x) => x.customerId)!;
    expect(productLife(s, sale.productId)).toBeGreaterThan(0);
    for (const c of s.customers.slice(0, 200)) {
      for (const r of refillsFor(s, c.id)) expect(r.daysAgo).toBeGreaterThanOrEqual(r.lifeDays - 7);
    }
  });

  it("recommends products the customer has not bought, in stock", () => {
    const bought = new Set(s.productSales.filter((x) => x.customerId === DEMO_CUSTOMER_ID).map((x) => x.productId));
    for (const r of recommendationsFor(s, DEMO_CUSTOMER_ID)) {
      expect(bought.has(r.product.id)).toBe(false);
      expect(r.product.stock).toBeGreaterThan(0);
    }
  });
});
