import type { Barber, Customer, Plan, Snapshot } from "../types";
import { addDays, dayKey } from "../time";
import { clubTotals } from "../metrics";
import { expectedReturn, visitStats, type VisitStats } from "./history";

/**
 * Club candidates: customers who pay per visit and would pay the same or less in a plan, from
 * what they actually did in the last 90 days. Each plan is compared with the visits it covers
 * plus what it leaves out (paid per visit), the same way the plan comparison on /clube does.
 * Nothing here guesses: a candidate needs at least 2 visits and about one a month.
 */

export type CandidateSegment = "saves" | "even" | "near";
export type Chance = "alta" | "media" | "baixa";

export interface CandidateMoment {
  /** scheduled = offer at the counter on the next visit; overdue = past their rhythm, message now; upcoming = message a few days before they are due. */
  kind: "scheduled" | "overdue" | "upcoming";
  /** Day of the next visit, or the day they are due back. */
  day: string;
  /** Start of the scheduled visit (ISO), when there is one. */
  startsAt: string | null;
  barberId: string | null;
}

export interface ClubCandidate {
  customer: Customer;
  /** Account holder who decides and pays (the customer, or who manages them). */
  decider: Customer;
  stats: VisitStats;
  plan: Plan;
  segment: CandidateSegment;
  /** What they spend a month today on services a plan can cover. */
  payNowCents: number;
  /** Plan fee + the coverable services the plan leaves out. */
  inPlanCents: number;
  /** payNow − inPlan: positive = cheaper in the plan. */
  savingCents: number;
  /** 0–100: how likely this conversation goes well (savings, frequency, regularity, recency). */
  score: number;
  chance: Chance;
  /** Barber with the relationship: who should make the offer. */
  offerBarberId: string | null;
  moment: CandidateMoment;
}

const CLOSE_CENTS = 1500;
const MIN_VISITS = 2;
const MIN_VISITS_PER_MONTH = 1;

export function closeThreshold(payNowCents: number): number {
  return Math.max(CLOSE_CENTS, Math.round(payNowCents * 0.05));
}

/** Best plan for this monthly use: the one that leaves the customer best off. */
export function bestPlanFor(plans: Plan[], st: VisitStats): { plan: Plan; inPlanCents: number; savingCents: number } | null {
  const use = st.coverableMonthlyCents;
  const payNow = use.haircut + use.beard;
  let best: { plan: Plan; inPlanCents: number; savingCents: number } | null = null;
  for (const plan of plans) {
    const coversSomething = plan.covers.some((c) => use[c] > 0);
    if (!coversSomething) continue;
    const left = (plan.covers.includes("haircut") ? 0 : use.haircut) + (plan.covers.includes("beard") ? 0 : use.beard);
    const inPlanCents = plan.priceCents + left;
    const savingCents = payNow - inPlanCents;
    if (!best || savingCents > best.savingCents || (savingCents === best.savingCents && plan.priceCents < best.plan.priceCents)) {
      best = { plan, inPlanCents, savingCents };
    }
  }
  return best;
}

export function segmentFor(savingCents: number, payNowCents: number, avgVisitCents: number): CandidateSegment | null {
  const t = closeThreshold(payNowCents);
  if (savingCents >= t) return "saves";
  if (Math.abs(savingCents) < t) return "even";
  // One more visit a month would make the plan pay off.
  if (-savingCents <= avgVisitCents) return "near";
  return null;
}

/** 0–100. Savings weigh most; then how often, how regular and how recent the visits are. */
export function candidateScore(segment: CandidateSegment, savingCents: number, payNowCents: number, st: VisitStats): number {
  const econ = segment === "saves" ? 25 + 15 * Math.min(1, savingCents / Math.max(1, payNowCents * 0.25)) : segment === "even" ? 15 : 0;
  const frequency = 25 * Math.min(1, st.visitsPerMonth / 2.5);
  const regularity = st.gapVariation === null ? 7 : 15 * (1 - Math.min(1, st.gapVariation));
  const gap = st.avgGapDays ?? 30;
  const since = st.daysSinceLast ?? 999;
  const recency = st.next || since <= gap * 1.2 ? 15 : since <= gap * 2 ? 8 : 0;
  const loyalty = 5 * st.mainBarberShare;
  return Math.round(Math.min(100, econ + frequency + regularity + recency + loyalty));
}

/** "Quase lá" (needs one more visit a month) is never more than a low chance: today the plan costs more. */
export function chanceFor(score: number, segment: CandidateSegment = "saves"): Chance {
  if (segment === "near") return "baixa";
  return score >= 70 ? "alta" : score >= 50 ? "media" : "baixa";
}

export function clubCandidates(s: Snapshot, windowDays?: number): ClubCandidate[] {
  const today = dayKey(s.now);
  const stats = visitStats(s, windowDays);
  const customers = new Map(s.customers.map((c) => [c.id, c]));
  const members = new Set(s.subscriptions.filter((x) => x.status !== "canceled").map((x) => x.customerId));
  const pendingLead = new Set(s.leads.filter((l) => !members.has(l.customerId)).map((l) => l.customerId));
  const plans = [...s.plans].sort((a, b) => a.priceCents - b.priceCents);

  const out: ClubCandidate[] = [];
  for (const st of stats.values()) {
    if (members.has(st.customerId) || pendingLead.has(st.customerId)) continue;
    if (st.visits < MIN_VISITS || st.visitsPerMonth < MIN_VISITS_PER_MONTH) continue;
    const customer = customers.get(st.customerId);
    if (!customer) continue;
    const best = bestPlanFor(plans, st);
    if (!best) continue;
    const payNow = st.coverableMonthlyCents.haircut + st.coverableMonthlyCents.beard;
    const segment = segmentFor(best.savingCents, payNow, st.avgCoverableVisitCents);
    if (!segment) continue;
    const score = candidateScore(segment, best.savingCents, payNow, st);
    out.push({
      customer,
      decider: (customer.holderId ? customers.get(customer.holderId) : null) ?? customer,
      stats: st,
      plan: best.plan,
      segment,
      payNowCents: payNow,
      inPlanCents: best.inPlanCents,
      savingCents: best.savingCents,
      score,
      chance: chanceFor(score, segment),
      offerBarberId: st.next?.barberId ?? st.mainBarberId,
      moment: momentFor(st, customer, today),
    });
  }
  return out.sort((a, b) => b.score - a.score || b.savingCents - a.savingCents);
}

function momentFor(st: VisitStats, customer: Customer, today: string): CandidateMoment {
  if (st.next) return { kind: "scheduled", day: dayKey(st.next.startsAt), startsAt: st.next.startsAt, barberId: st.next.barberId };
  const due = expectedReturn(st, customer.cycleDays) ?? today;
  return due <= today ? { kind: "overdue", day: due, startsAt: null, barberId: st.mainBarberId } : { kind: "upcoming", day: addDays(due, -3) < today ? today : addDays(due, -3), startsAt: null, barberId: st.mainBarberId };
}

// ---------------------------------------------------------------------------------------

export interface CandidateInsights {
  /** Customers without a plan who came at least once in the window. */
  walkInsActive: number;
  /** …and came back at least twice. */
  walkInsRegular: number;
  candidates: number;
  bySegment: Record<CandidateSegment, number>;
  byChance: Record<Chance, number>;
  /** Monthly fees if the candidates subscribe, by chance of closing. */
  potentialMrrByChance: Record<Chance, number>;
  /** What the candidates spend today, per visit, on what the plans would cover. */
  candidatesPayNowCents: number;
  currentMrrCents: number;
  /** What the "saves" candidates would keep in their pocket each month. */
  customerSavingsCents: number;
  byBarber: { barber: Barber; count: number; high: number; potentialMrrCents: number; thisWeek: number }[];
  byPlan: { plan: Plan; count: number; potentialMrrCents: number }[];
  /** Candidates with a visit booked in the next 7 days: the offer can be made in person. */
  comingThisWeek: ClubCandidate[];
}

export function candidateInsights(s: Snapshot, list: ClubCandidate[] = clubCandidates(s)): CandidateInsights {
  const today = dayKey(s.now);
  const weekEnd = addDays(today, 6);
  const stats = visitStats(s);
  const members = new Set(s.subscriptions.filter((x) => x.status !== "canceled").map((x) => x.customerId));
  let walkInsActive = 0;
  let walkInsRegular = 0;
  for (const st of stats.values()) {
    if (members.has(st.customerId) || st.visits === 0) continue;
    walkInsActive++;
    if (st.visits >= MIN_VISITS) walkInsRegular++;
  }

  const bySegment: Record<CandidateSegment, number> = { saves: 0, even: 0, near: 0 };
  const byChance: Record<Chance, number> = { alta: 0, media: 0, baixa: 0 };
  const barbers = new Map(s.barbers.map((b) => [b.id, b]));
  const barberAgg = new Map<string, CandidateInsights["byBarber"][number]>();
  const planAgg = new Map<string, CandidateInsights["byPlan"][number]>();
  const potential: Record<Chance, number> = { alta: 0, media: 0, baixa: 0 };
  let payNow = 0;
  let savings = 0;

  for (const c of list) {
    bySegment[c.segment]++;
    byChance[c.chance]++;
    potential[c.chance] += c.plan.priceCents;
    payNow += c.payNowCents;
    if (c.segment === "saves") savings += c.savingCents;
    const thisWeek = c.moment.kind === "scheduled" && c.moment.day <= weekEnd;
    const b = c.offerBarberId ? barbers.get(c.offerBarberId) : undefined;
    if (b) {
      const agg = barberAgg.get(b.id) ?? { barber: b, count: 0, high: 0, potentialMrrCents: 0, thisWeek: 0 };
      agg.count++;
      if (c.chance === "alta") agg.high++;
      agg.potentialMrrCents += c.plan.priceCents;
      if (thisWeek) agg.thisWeek++;
      barberAgg.set(b.id, agg);
    }
    const p = planAgg.get(c.plan.id) ?? { plan: c.plan, count: 0, potentialMrrCents: 0 };
    p.count++;
    p.potentialMrrCents += c.plan.priceCents;
    planAgg.set(c.plan.id, p);
  }

  return {
    walkInsActive,
    walkInsRegular,
    candidates: list.length,
    bySegment,
    byChance,
    potentialMrrByChance: potential,
    candidatesPayNowCents: payNow,
    currentMrrCents: clubTotals(s, { from: today, to: today }).mrrCents,
    customerSavingsCents: savings,
    byBarber: [...barberAgg.values()].sort((a, b) => b.potentialMrrCents - a.potentialMrrCents),
    byPlan: [...planAgg.values()].sort((a, b) => b.count - a.count),
    comingThisWeek: list.filter((c) => c.moment.kind === "scheduled" && c.moment.day <= weekEnd).sort((a, b) => (a.moment.startsAt ?? "").localeCompare(b.moment.startsAt ?? "")),
  };
}
