import { describe, expect, it } from "vitest";
import { planAdvice, planTotal, recommendedPlan, usageFromHistory } from "@/domain/plan-advice";
import type { Plan } from "@/domain/types";
import { PLANS } from "@/server/data/catalog";
import { buildDemoSnapshot, DEMO_CUSTOMER_ID } from "@/server/data/demo-dataset";

const P = { haircutCents: 8000, beardCents: 6500 };
const plan = (id: string) => PLANS.find((p) => p.id === id)!;
const corte = plan("plan-haircut-plus"); // 149,99
const barba = plan("plan-beard-plus"); // 159,99
const cb = plan("plan-cb-plus"); // 249,99
const cbPremium = plan("plan-cb-premium"); // 349,99

describe("plan advice by visit frequency", () => {
  it("low: one cut a month is cheaper per visit, and says from when the plan pays off", () => {
    const a = planAdvice(corte, { haircuts: 1, beards: 0 }, P, { known: true });
    expect(a.kind).toBe("costs_more");
    expect(a.todayCents).toBe(8000);
    expect(a.differenceCents).toBe(8000 - 14999);
    expect(a.breakEven.haircuts).toBe(2);
    expect(a.message).toContain("pagar cada visita sai R$ 70 mais barato");
    expect(a.message).toContain("2 cortes por mês");
    expect(a.message).not.toMatch(/ilimitad|mais vezes/);
  });

  it("moderate: two cuts a month is about the same price", () => {
    const a = planAdvice(corte, { haircuts: 2, beards: 0 }, P, { known: true });
    expect(a.kind).toBe("close");
    expect(a.message).toContain("valor fixo");
  });

  it("high: three cuts a month genuinely saves, with the amount", () => {
    const a = planAdvice(corte, { haircuts: 3, beards: 0 }, P, { known: true });
    expect(a.kind).toBe("saves");
    expect(a.differenceCents).toBe(24000 - 14999);
    expect(a.message).toContain("R$ 90");
  });

  it("counts what the plan does not cover as paid per visit", () => {
    expect(planTotal(corte, { haircuts: 2, beards: 2 }, P)).toEqual({ totalCents: 14999 + 13000, extraCents: 13000 });
    const a = planAdvice(corte, { haircuts: 2, beards: 2 }, P, { known: true });
    expect(a.message).toContain("Já conta R$ 130");
  });

  it("does not push a plan that covers nothing the person does", () => {
    expect(planAdvice(barba, { haircuts: 2, beards: 0 }, P, { known: true }).kind).toBe("not_for_you");
  });

  it("asks for usage instead of guessing when nothing is known", () => {
    const a = planAdvice(corte, { haircuts: 0, beards: 0 }, P, { known: false });
    expect(a.kind).toBe("needs_usage");
    expect(a.message).toContain("Informe");
  });

  it("only talks about extra visits when the plan states how many it includes", () => {
    const limited: Plan = { ...corte, monthlyLimit: 4 };
    expect(planAdvice(limited, { haircuts: 1, beards: 0 }, P, { known: true }).message).toContain("até 4 atendimentos");
  });

  it("highlights only a plan that saves, the one that saves most", () => {
    const u = { haircuts: 2, beards: 2 };
    const list = PLANS.map((p) => ({ plan: p, advice: planAdvice(p, u, P, { known: true }) }));
    expect(recommendedPlan(list)).toBe("plan-cb-plus");
    const low = PLANS.map((p) => ({ plan: p, advice: planAdvice(p, { haircuts: 1, beards: 0 }, P, { known: true }) }));
    expect(recommendedPlan(low)).toBeNull();
  });
});

describe("members comparing with their current plan", () => {
  const u = { haircuts: 2, beards: 2 };

  it("shows the current plan against paying per visit", () => {
    const a = planAdvice(cb, u, P, { known: true, currentPlan: cb });
    expect(a.kind).toBe("current");
    expect(a.message).toContain("R$ 40 mais barato");
  });

  it("an upgrade that covers the beard they already pay for saves money", () => {
    const a = planAdvice(cb, u, P, { known: true, currentPlan: corte });
    expect(a.todayCents).toBe(14999 + 13000);
    expect(a.kind).toBe("saves");
  });

  it("a plan with less coverage says what it leaves out, not 'same coverage'", () => {
    const a = planAdvice(corte, u, P, { known: true, currentPlan: cb });
    expect(a.kind).toBe("costs_more");
    expect(a.message).toContain("Não cobre a barba que você faz hoje");
    expect(a.message).not.toContain("Premium");
  });

  it("a pricier upgrade says exactly how much more it costs", () => {
    const a = planAdvice(cbPremium, u, P, { known: true, currentPlan: cb });
    expect(a.kind).toBe("costs_more");
    expect(a.message).toContain("Mesma cobertura, na linha Premium: R$ 100 a mais");
  });
});

describe("usage from history", () => {
  it("estimates the demo customer's habits from the last 90 days", () => {
    const s = buildDemoSnapshot(new Date("2026-10-20T20:30:00Z"));
    const u = usageFromHistory(s, DEMO_CUSTOMER_ID);
    expect(u.enough).toBe(true);
    expect(u.haircuts).toBe(2);
    expect(u.beards).toBe(2);
  });
});
