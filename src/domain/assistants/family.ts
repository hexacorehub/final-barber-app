import type { Customer, Plan, Snapshot } from "../types";
import { addDays, dayKey, daysBetween } from "../time";
import { household } from "../household";
import { planAdvice, recommendedPlan, usageFromHistory, type Prices } from "../plan-advice";
import { visitStats } from "./history";

/**
 * The account seen as a family: who is due for a cut, whose plan already paid for itself
 * this month, and which plan fits each person — so the holder decides for everyone at once.
 */

export function pricesOf(s: Snapshot): Prices {
  const haircut = s.services.find((x) => x.coverage === "haircut" && x.category === "hair");
  const beard = s.services.find((x) => x.coverage === "beard");
  return { haircutCents: haircut?.priceCents ?? 0, beardCents: beard?.priceCents ?? 0 };
}

export interface FamilyNote {
  customer: Customer;
  kind: "due" | "plan_paid_off" | "plan_unused";
  text: string;
  /** Where the holder acts on it. */
  href: string;
}

export function familyNotes(s: Snapshot, holderId: string): FamilyNote[] {
  const today = dayKey(s.now);
  const month = today.slice(0, 7);
  const stats = visitStats(s, 120);
  const members = household(s, holderId);
  const out: FamilyNote[] = [];
  for (const m of members) {
    const first = m.customer.name.split(" ")[0];
    const who = m.isHolder ? "Você" : first;
    const st = stats.get(m.customer.id);
    const upcoming = s.appointments.some((a) => a.customerId === m.customer.id && a.status === "scheduled" && a.startsAt >= s.now);
    if (st?.lastVisit && !upcoming) {
      const rhythm = st.avgGapDays ?? m.customer.cycleDays;
      const since = daysBetween(st.lastVisit, today);
      if (since >= rhythm) {
        out.push({
          customer: m.customer,
          kind: "due",
          text: `${m.isHolder ? "Você não corta" : `${first} não corta`} há ${since} dias; costuma ser a cada ${rhythm}. Quer agendar?`,
          href: "/agendar",
        });
      }
    }
    if (m.plan && m.subscription?.status === "active") {
      const covered = s.appointments
        .filter((a) => a.customerId === m.customer.id && a.status === "completed" && dayKey(a.startsAt).startsWith(month))
        .reduce((t, a) => t + a.coveredCents, 0);
      if (covered >= m.plan.priceCents) {
        out.push({ customer: m.customer, kind: "plan_paid_off", text: `${m.isHolder ? "Seu plano" : `O plano de ${first}`} já se pagou este mês: os atendimentos do mês valem mais que a mensalidade.`, href: "/conta" });
      } else if (st && st.daysSinceLast !== null && st.daysSinceLast > 30) {
        out.push({ customer: m.customer, kind: "plan_unused", text: `${who} tem o ${m.plan.name.replace("Mister Club ", "")} e não vem há ${st.daysSinceLast} dias: o plano está parado.`, href: "/agendar" });
      }
    }
  }
  return out;
}

export interface FamilyPlanRow {
  customer: Customer;
  isHolder: boolean;
  current: Plan | null;
  /** Best plan for their habits (null = paying per visit is better, or no history). */
  suggested: Plan | null;
  /** Monthly cost today for their visits (current plan + extras, or per visit). */
  todayCents: number;
  /** Monthly cost with the suggestion. */
  suggestedCents: number;
  enoughHistory: boolean;
}

export interface FamilyPlan {
  rows: FamilyPlanRow[];
  todayCents: number;
  suggestedCents: number;
}

/** For each person of the account: what they pay today and what fits their habits best. */
export function familyPlan(s: Snapshot, holderId: string): FamilyPlan {
  const prices = pricesOf(s);
  const rows: FamilyPlanRow[] = household(s, holderId).map((m) => {
    const usage = usageFromHistory(s, m.customer.id);
    const list = s.plans.map((plan) => ({ plan, advice: planAdvice(plan, usage, prices, { currentPlan: m.plan, known: usage.enough }) }));
    const bestId = recommendedPlan(list);
    const best = bestId ? (list.find((x) => x.plan.id === bestId) ?? null) : null;
    const todayCents = list[0]?.advice.todayCents ?? 0;
    return {
      customer: m.customer,
      isHolder: m.isHolder,
      current: m.plan,
      suggested: best?.plan ?? m.plan,
      todayCents,
      suggestedCents: best ? best.advice.totalCents : todayCents,
      enoughHistory: usage.enough,
    };
  });
  return { rows, todayCents: rows.reduce((t, r) => t + r.todayCents, 0), suggestedCents: rows.reduce((t, r) => t + r.suggestedCents, 0) };
}

/** Day the person is due back, for "agendar" hints. */
export function dueDay(s: Snapshot, customerId: string): string | null {
  const st = visitStats(s, 120).get(customerId);
  const c = s.customers.find((x) => x.id === customerId);
  if (!st?.lastVisit || !c) return null;
  return addDays(st.lastVisit, st.avgGapDays ?? c.cycleDays);
}
