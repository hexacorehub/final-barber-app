import { describe, expect, it } from "vitest";
import { cnpjRoot, formatCnpj, isValidCnpj } from "@/domain/documents";
import { legalEntities } from "@/domain/legal-entities";
import { periodRange, revenueMix } from "@/domain/metrics";
import { scopeToUnit, unitBreakdown } from "@/domain/units";
import { buildDemoSnapshot } from "@/server/data/demo-dataset";

const s = buildDemoSnapshot(new Date("2026-10-27T15:00:00Z"));
const r = periodRange("mes", new Date(s.now));

describe("units and companies", () => {
  it("validates and formats CNPJ", () => {
    for (const u of s.units) expect(isValidCnpj(u.cnpj!)).toBe(true);
    expect(isValidCnpj("12.345.678/0001-00")).toBe(false);
    expect(formatCnpj("12345678000195")).toBe("12.345.678/0001-95");
    expect(cnpjRoot("12.345.678/0002-76")).toBe("12345678");
  });

  it("groups branches of the same company", () => {
    const e = legalEntities(s);
    expect(e.length).toBe(1);
    expect(e[0].branches).toBe(true);
    const split = legalEntities({ ...s, units: s.units.map((u, i) => ({ ...u, cnpj: i ? "11.222.333/0001-81" : u.cnpj })) });
    expect(split.length).toBe(2);
  });

  it("the units add up to the whole shop", () => {
    const parts = unitBreakdown(s, r);
    const whole = revenueMix(s, r);
    expect(parts.reduce((t, u) => t + u.revenueCents, 0)).toBe(whole.totalCents);
    expect(parts.reduce((t, u) => t + u.completed, 0)).toBe(whole.completed);
  });

  it("a scoped snapshot only has that unit's barbers, visits and plans", () => {
    const one = scopeToUnit(s, "unit-guarapiranga");
    expect(one.barbers.every((b) => b.unitId === "unit-guarapiranga")).toBe(true);
    expect(one.appointments.every((a) => a.unitId === "unit-guarapiranga")).toBe(true);
    expect(one.subscriptions.every((x) => x.billingUnitId === "unit-guarapiranga")).toBe(true);
  });
});
