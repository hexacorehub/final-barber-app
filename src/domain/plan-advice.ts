import type { ClubCoverage, Plan, Snapshot } from "./types";
import { addDays, dayKey, daysBetween } from "./time";

/**
 * Honest, personalized plan comparison. A plan is never presented as saving money unless the
 * numbers say so; when it costs more, the message says so and shows from how many visits a
 * month it would pay off. Extra visits are only mentioned when the plan states how many it
 * includes (`monthlyLimit`); none of the current plans do, so that is confirmed by the team.
 */

export interface Usage {
  haircuts: number;
  beards: number;
}

export interface UsageProfile extends Usage {
  /** Visits counted and the window they came from. */
  visits: number;
  windowDays: number;
  /** Enough history to estimate habits (at least 2 visits over at least 30 days). */
  enough: boolean;
}

export interface Prices {
  haircutCents: number;
  beardCents: number;
}

/** Below this difference (or 5% of today's spending, whichever is larger) prices are "close". */
const CLOSE_CENTS = 1500;

/** Visits per month estimated from completed appointments in the last `windowDays` days. */
export function usageFromHistory(s: Snapshot, customerId: string, windowDays = 90): UsageProfile {
  const today = dayKey(s.now);
  const from = addDays(today, -windowDays + 1);
  const coverage = new Map(s.services.map((x) => [x.id, x.coverage]));
  const visits = s.appointments.filter((a) => a.customerId === customerId && a.status === "completed" && dayKey(a.startsAt) >= from && dayKey(a.startsAt) <= today);
  const customer = s.customers.find((c) => c.id === customerId);
  const knownDays = customer ? Math.min(windowDays, Math.max(1, daysBetween(dayKey(customer.createdAt), today) + 1)) : windowDays;
  const span = Math.max(30, knownDays);
  let haircuts = 0;
  let beards = 0;
  for (const v of visits) {
    if (v.serviceIds.some((id) => coverage.get(id) === "haircut")) haircuts++;
    if (v.serviceIds.some((id) => coverage.get(id) === "beard")) beards++;
  }
  const perMonth = (n: number) => Math.round((n * 30) / span);
  return { haircuts: perMonth(haircuts), beards: perMonth(beards), visits: visits.length, windowDays: span, enough: visits.length >= 2 && knownDays >= 30 };
}

/** What a month of these visits costs paying each one. */
export function perVisitCost(u: Usage, p: Prices): number {
  return u.haircuts * p.haircutCents + u.beards * p.beardCents;
}

/** A plan's monthly total for these visits: the fee plus what it does not cover, paid per visit. */
export function planTotal(plan: Plan, u: Usage, p: Prices): { totalCents: number; extraCents: number } {
  const extraCents = (plan.covers.includes("haircut") ? 0 : u.haircuts * p.haircutCents) + (plan.covers.includes("beard") ? 0 : u.beards * p.beardCents);
  return { totalCents: plan.priceCents + extraCents, extraCents };
}

export type AdviceKind = "current" | "saves" | "close" | "costs_more" | "not_for_you" | "needs_usage";

export interface PlanAdvice {
  kind: AdviceKind;
  /** What the person pays today for these visits (per visit, or their current plan). */
  todayCents: number;
  totalCents: number;
  extraCents: number;
  /** today − total: positive means the plan is cheaper. */
  differenceCents: number;
  /** Covered visits a month from which the fee alone is cheaper than paying per visit. */
  breakEven: { haircuts: number | null; beards: number | null };
  message: string;
}

const brl = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).replace(/ /g, " ");

function usageText(u: Usage): string {
  const parts = [];
  if (u.haircuts) parts.push(`${u.haircuts} ${u.haircuts === 1 ? "corte" : "cortes"}`);
  if (u.beards) parts.push(`${u.beards} ${u.beards === 1 ? "barba" : "barbas"}`);
  return parts.join(" e ");
}

const COVER_LABEL: Record<ClubCoverage, string> = { haircut: "corte", beard: "barba" };

/** Break-even counted on the services the plan covers, at their per-visit price. */
function breakEven(plan: Plan, p: Prices): PlanAdvice["breakEven"] {
  const only = (c: ClubCoverage, price: number) => (plan.covers.length === 1 && plan.covers[0] === c ? Math.ceil(plan.priceCents / price) : null);
  if (plan.covers.length === 2) {
    // Both covered: express it as "cut + beard" visits.
    const n = Math.ceil(plan.priceCents / (p.haircutCents + p.beardCents));
    return { haircuts: n, beards: n };
  }
  return { haircuts: only("haircut", p.haircutCents), beards: only("beard", p.beardCents) };
}

function breakEvenText(plan: Plan, b: PlanAdvice["breakEven"]): string {
  if (plan.covers.length === 2 && b.haircuts) return `${b.haircuts} visitas de corte e barba por mês`;
  if (b.haircuts) return `${b.haircuts} cortes por mês`;
  if (b.beards) return `${b.beards} barbas por mês`;
  return "";
}

/**
 * Advice for one plan, given the person's visits a month and, if they have one, their
 * current plan. `known` is false when the visits were not informed nor found in history.
 */
export function planAdvice(plan: Plan, u: Usage, p: Prices, opts: { currentPlan?: Plan | null; known: boolean }): PlanAdvice {
  const { totalCents, extraCents } = planTotal(plan, u, p);
  const current = opts.currentPlan ?? null;
  const todayCents = current ? planTotal(current, u, p).totalCents : perVisitCost(u, p);
  const differenceCents = todayCents - totalCents;
  const be = breakEven(plan, p);
  const base = { todayCents, totalCents, extraCents, differenceCents, breakEven: be };
  const uses = usageText(u);
  const covered = plan.covers.filter((c) => (c === "haircut" ? u.haircuts : u.beards) > 0);

  if (!opts.known || (!u.haircuts && !u.beards)) {
    return { ...base, kind: "needs_usage", message: `Informe quantas vezes você vem por mês para comparar. Esse plano compensa a partir de ${breakEvenText(plan, be)}.` };
  }

  if (current && current.id === plan.id) {
    const perVisit = perVisitCost(u, p);
    const vsVisit = perVisit - totalCents;
    return {
      ...base,
      kind: "current",
      message:
        vsVisit > 0
          ? `Seu plano atual. Com ${uses} por mês, sai ${brl(vsVisit)} mais barato do que pagar cada visita (${brl(perVisit)}).`
          : `Seu plano atual. Com ${uses} por mês, pagar cada visita sairia ${brl(-vsVisit)} mais barato; ele compensa a partir de ${breakEvenText(plan, be)}.`,
    };
  }

  if (covered.length === 0) {
    return { ...base, kind: "not_for_you", message: `Cobre só ${plan.covers.map((c) => COVER_LABEL[c]).join(" e ")}, que você não faz hoje.` };
  }

  const threshold = Math.max(CLOSE_CENTS, Math.round(todayCents * 0.05));
  // "em relação ao seu plano atual" / "em relação a pagar cada visita"; "que o seu plano" / "que pagar".
  const relativeTo = current ? `ao seu plano atual (${brl(todayCents)})` : `a pagar cada visita (${brl(todayCents)})`;
  const sameAs = current ? `o seu plano atual (${brl(todayCents)})` : `pagar cada visita (${brl(todayCents)})`;
  const extraNote = extraCents ? ` Já conta ${brl(extraCents)} do que ele não cobre.` : "";

  if (differenceCents >= threshold) {
    return { ...base, kind: "saves", message: `Com ${uses} por mês, você economiza cerca de ${brl(differenceCents)} por mês em relação ${relativeTo}.${extraNote}` };
  }
  if (Math.abs(differenceCents) < threshold) {
    return {
      ...base,
      kind: "close",
      message: `Com ${uses} por mês, sai praticamente o mesmo que ${sameAs}. A vantagem é o valor fixo todo mês.${extraNote}`,
    };
  }
  const more = -differenceCents;
  const limit = plan.monthlyLimit;
  const usage = Math.max(u.haircuts, u.beards);
  const moreVisits =
    limit !== null && limit > usage ? ` Ele inclui até ${limit} atendimentos por mês: dá para vir mais vezes pelo mesmo valor.` : "";
  if (current) {
    const adds = plan.covers.filter((c) => !current.covers.includes(c));
    const loses = current.covers.filter((c) => !plan.covers.includes(c) && (c === "haircut" ? u.haircuts : u.beards) > 0);
    const lead = loses.length
      ? `Não cobre ${loses.map((c) => `a ${COVER_LABEL[c]}`).join(" e ")} que você faz hoje; pagando à parte, fica`
      : adds.length
        ? `Inclui também ${adds.map((c) => `a ${COVER_LABEL[c]}`).join(" e ")}:`
        : plan.tier === "premium" && current.tier !== "premium"
          ? "Mesma cobertura, na linha Premium:"
          : "Fica";
    return { ...base, kind: "costs_more", message: `${lead} ${brl(more)} a mais por mês que o seu plano atual.${moreVisits}` };
  }
  return {
    ...base,
    kind: "costs_more",
    message: `Com ${uses} por mês, pagar cada visita sai ${brl(more)} mais barato. O plano compensa a partir de ${breakEvenText(plan, be)}.${moreVisits}`,
  };
}

/** The plan to highlight: the one that genuinely saves the most (none if nothing saves). */
export function recommendedPlan(advice: { plan: Plan; advice: PlanAdvice }[]): string | null {
  const best = advice.filter((a) => a.advice.kind === "saves").sort((a, b) => b.advice.differenceCents - a.advice.differenceCents)[0];
  return best?.plan.id ?? null;
}
