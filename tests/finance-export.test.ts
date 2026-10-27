import { describe, expect, it } from "vitest";
import { financeExport } from "@/domain/finance-export";
import { barberRevenue, periodRange, revenueMix } from "@/domain/metrics";
import { buildDemoSnapshot } from "@/server/data/demo-dataset";

const s = buildDemoSnapshot(new Date("2026-10-27T15:00:00Z"));
const r = periodRange("mes", new Date(s.now));

describe("finance export", () => {
  const ex = financeExport(s, r);

  it("matches the dashboard's revenue for the period", () => {
    const total = ex.companies.reduce((t, c) => t + c.incomeCents, 0);
    expect(total).toBe(revenueMix(s, r).totalCents);
  });

  it("matches the commissions the dashboard shows", () => {
    const partners = ex.companies.flatMap((c) => c.units).reduce((t, u) => t + u.partners.amountCents, 0);
    const dash = barberRevenue(s, r, { includeInactive: true }).reduce((t, b) => t + b.serviceCommissionCents + b.productCommissionCents, 0);
    expect(Math.abs(partners - dash)).toBeLessThan(5000);
  });

  it("uses stable ids, one per unit, day and kind", () => {
    const ids = ex.companies.flatMap((c) => c.units.flatMap((u) => u.days.flatMap((d) => d.lines.map((l) => l.externalId))));
    expect(new Set(ids).size).toBe(ids.length);
    expect(financeExport(s, r).companies[0].units[0].days[0].lines[0].externalId).toBe(ids[0]);
  });

  it("filters by CNPJ root or by a unit's full CNPJ", () => {
    expect(financeExport(s, { ...r, cnpj: "12345678" }).companies.length).toBe(1);
    expect(financeExport(s, { ...r, cnpj: "12.345.678/0002-76" }).companies[0].units.map((u) => u.unit.id)).toEqual(["unit-guarapiranga"]);
    expect(financeExport(s, { ...r, cnpj: "99999999" }).companies.length).toBe(0);
  });
});
