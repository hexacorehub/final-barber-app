import type { Appointment, Barber, Customer, Plan, Product, Snapshot, Subscription } from "./types";
import { addDays, addMonths, dayKey, daysBetween, daysInMonth, weekdayOf } from "./time";
import { DEFAULT_REFERRAL_RULES, referralRules, type CreditStatus, type ReferralRules } from "./referral-rules";

/**
 * Every number the dashboards show is computed here from the raw records — nothing is typed
 * in by hand. Ranges are inclusive São Paulo day keys.
 */

export type PeriodId = "mes" | "anterior" | "30d";

export interface Range {
  id: PeriodId;
  from: string;
  to: string;
  label: string;
}

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

export function periodRange(id: PeriodId, now: Date): Range {
  const today = dayKey(now);
  const month = today.slice(0, 7);
  if (id === "anterior") {
    const prev = addMonths(month, -1);
    return { id, from: `${prev}-01`, to: `${prev}-${String(daysInMonth(prev)).padStart(2, "0")}`, label: MONTHS[Number(prev.slice(5)) - 1] };
  }
  if (id === "30d") return { id, from: addDays(today, -29), to: today, label: "últimos 30 dias" };
  return { id, from: `${month}-01`, to: today, label: `${MONTHS[Number(month.slice(5)) - 1]} até hoje` };
}

export function inRange(iso: string, r: { from: string; to: string }): boolean {
  const k = dayKey(iso);
  return k >= r.from && k <= r.to;
}

const isMemberStatus = (s: Subscription) => s.status === "active" || s.status === "past_due";

/** Subscription in force on a day (ignores the current status except for cancellation). */
function activeOn(s: Subscription, key: string): boolean {
  return dayKey(s.startedAt) <= key && (!s.canceledAt || dayKey(s.canceledAt) > key);
}

// ---------------------------------------------------------------------------------------
// Club revenue

export interface ClubCharge {
  subscriptionId: string;
  planId: string;
  day: string;
  /** What was actually charged (list price minus any referral discount). */
  amountCents: number;
  discountCents: number;
}

/**
 * Monthly charges that happened in the range: one per subscription per billing day, while
 * it was in force. The latest charge of a past-due subscription failed, so it is left out;
 * paused subscriptions are not charged.
 */
export function clubCharges(s: Snapshot, r: { from: string; to: string }): ClubCharge[] {
  const plans = new Map(s.plans.map((p) => [p.id, p]));
  const today = dayKey(s.now);
  const discounts = referralDiscounts(s);
  const out: ClubCharge[] = [];
  for (const sub of s.subscriptions) {
    const plan = plans.get(sub.planId);
    if (!plan) continue;
    for (let m = r.from.slice(0, 7); m <= r.to.slice(0, 7); m = addMonths(m, 1)) {
      const day = billingDayIn(sub.billingDay, m);
      if (day < r.from || day > r.to || day > today) continue;
      if (!charged(sub, day, today)) continue;
      const discountCents = discounts.get(sub.id)?.get(day) ?? 0;
      out.push({ subscriptionId: sub.id, planId: plan.id, day, amountCents: plan.priceCents - discountCents, discountCents });
    }
  }
  return out;
}

function billingDayIn(billingDay: number, month: string): string {
  return `${month}-${String(Math.min(billingDay, daysInMonth(month))).padStart(2, "0")}`;
}

/** Whether a subscription is (or was) charged on a billing day. */
function charged(sub: Subscription, day: string, today: string): boolean {
  if (!activeOn(sub, day)) return false;
  if (day > today) return sub.status === "active";
  if (sub.status === "paused" && day >= addDays(today, -30)) return false;
  if (sub.status === "past_due" && day === lastBillingDay(sub.billingDay, today)) return false;
  return true;
}

// ---------------------------------------------------------------------------------------
// Referral program. The rules live in domain/referral-rules.ts (parameters the owner can
// change): one credit per friend, born when the friend's first fee is paid, at most
// `perCharge` per monthly fee, a line of at most `maxQueued`, valid for `expiryMonths`, and
// applied to one plan of the account holder only.

export const REFERRAL_DISCOUNT = DEFAULT_REFERRAL_RULES.discountPct;
const FUTURE_MONTHS = 3;

export interface ReferralCredit {
  /** The friend's subscription that earned it. */
  friendSubscriptionId: string;
  friendId: string;
  /** Account holder who receives it. */
  beneficiaryId: string;
  /** Day the friend's first fee was paid; null while it was not. */
  bornOn: string | null;
  expiresOn: string | null;
  status: CreditStatus;
  /** Plan that gets the discount, and the fee it was (or will be) used on. */
  targetSubscriptionId: string | null;
  usedOn: string | null;
  amountCents: number;
}

const creditCache = new WeakMap<Snapshot, ReferralCredit[]>();

/** Every credit of the program, with what happened to it. */
export function referralCredits(s: Snapshot): ReferralCredit[] {
  const cached = creditCache.get(s);
  if (cached) return cached;
  const rules = referralRules(s);
  const today = dayKey(s.now);
  const customers = new Map(s.customers.map((c) => [c.id, c]));
  const plans = new Map(s.plans.map((p) => [p.id, p]));
  const holderOf = (id: string) => customers.get(id)?.holderId ?? id;

  const byBeneficiary = new Map<string, ReferralCredit[]>();
  for (const friend of s.subscriptions) {
    if (!friend.referredByCustomerId) continue;
    const beneficiaryId = holderOf(friend.referredByCustomerId);
    // Referring someone of your own account does not count.
    if (holderOf(friend.customerId) === beneficiaryId || friend.customerId === friend.referredByCustomerId) continue;
    const bornOn = firstPaidDay(friend, today);
    const credit: ReferralCredit = {
      friendSubscriptionId: friend.id,
      friendId: friend.customerId,
      beneficiaryId,
      bornOn,
      expiresOn: bornOn ? billingDayIn(Number(bornOn.slice(8)), addMonths(bornOn.slice(0, 7), rules.expiryMonths)) : null,
      status: bornOn ? "queued" : friend.status === "canceled" ? "friend_left" : "awaiting_payment",
      targetSubscriptionId: null,
      usedOn: null,
      amountCents: 0,
    };
    (byBeneficiary.get(beneficiaryId) ?? byBeneficiary.set(beneficiaryId, []).get(beneficiaryId)!).push(credit);
  }

  const out: ReferralCredit[] = [];
  for (const [beneficiaryId, credits] of byBeneficiary) {
    const target = referralTarget(s, beneficiaryId);
    const plan = target && plans.get(target.planId);
    const born = credits.filter((c) => c.bornOn).sort((a, b) => a.bornOn!.localeCompare(b.bornOn!));
    if (!target || !plan) {
      for (const c of born) c.status = "no_plan";
      out.push(...credits);
      continue;
    }
    // Walk the target plan's charges in order, interleaved with the births of credits.
    const lastMonth = addMonths(today.slice(0, 7), FUTURE_MONTHS);
    const charges: string[] = [];
    for (let m = born[0]?.bornOn?.slice(0, 7) ?? lastMonth; m <= lastMonth; m = addMonths(m, 1)) {
      const day = billingDayIn(target.billingDay, m);
      if (charged(target, day, today)) charges.push(day);
    }
    const line: ReferralCredit[] = [];
    let next = 0;
    const admit = (until: string) => {
      while (next < born.length && born[next].bornOn! < until) {
        const c = born[next++];
        drop(line, c.bornOn!);
        if (line.length >= rules.maxQueued) c.status = "over_limit";
        else {
          c.targetSubscriptionId = target.id;
          line.push(c);
        }
      }
    };
    const drop = (q: ReferralCredit[], day: string) => {
      for (let i = q.length - 1; i >= 0; i--) {
        if (q[i].expiresOn! <= day) {
          // Projected expirations stay "na fila" (with their date) until the day comes.
          q[i].status = q[i].expiresOn! <= today ? "expired" : "queued";
          q.splice(i, 1);
        }
      }
    };
    for (const day of charges) {
      admit(day);
      drop(line, day);
      for (let k = 0; k < rules.perCharge && line.length; k++) {
        const c = line.shift()!;
        c.usedOn = day;
        c.amountCents = Math.round(plan.priceCents * rules.discountPct);
        c.status = day <= today ? "applied" : "scheduled";
      }
    }
    admit("9999-12-31");
    drop(line, today);
    for (const c of line) c.targetSubscriptionId = target.id;
    out.push(...credits);
  }
  creditCache.set(s, out);
  return out;
}

/**
 * The friend's first fee is charged when the plan starts. It counts as paid unless that very
 * first charge failed (still past due within the first month) or the plan was canceled the
 * same day.
 */
function firstPaidDay(friend: Subscription, today: string): string | null {
  const start = dayKey(friend.startedAt);
  if (start > today) return null;
  if (friend.canceledAt && dayKey(friend.canceledAt) <= start) return null;
  if (friend.status === "past_due" && daysBetween(start, today) <= 31) return null;
  return start;
}

/** The plan that receives the holder's discounts: their own, else the most expensive they pay for. */
export function referralTarget(s: Snapshot, holderId: string): Subscription | null {
  const own = s.subscriptions.find((x) => x.customerId === holderId && x.status !== "canceled");
  if (own) return own;
  const prices = new Map(s.plans.map((p) => [p.id, p.priceCents]));
  return (
    s.subscriptions
      .filter((x) => x.payerCustomerId === holderId && x.status !== "canceled")
      .sort((a, b) => (prices.get(b.planId) ?? 0) - (prices.get(a.planId) ?? 0))[0] ?? null
  );
}

/** subscriptionId → billing day → discount in cents, past and for the next months. */
export function referralDiscounts(s: Snapshot): Map<string, Map<string, number>> {
  const out = new Map<string, Map<string, number>>();
  for (const c of referralCredits(s)) {
    if (!c.usedOn || !c.targetSubscriptionId) continue;
    const m = out.get(c.targetSubscriptionId) ?? out.set(c.targetSubscriptionId, new Map()).get(c.targetSubscriptionId)!;
    m.set(c.usedOn, (m.get(c.usedOn) ?? 0) + c.amountCents);
  }
  return out;
}

export interface ReferralSummary {
  code: string;
  /** Whether this person can refer (only account holders do). */
  canRefer: boolean;
  joined: { customer: Customer; plan: Plan; since: string; credit: ReferralCredit | null }[];
  pending: { customer: Customer; plan: Plan; since: string }[];
  usedCents: number;
  next: { day: string; discountCents: number; priceCents: number } | null;
  /** Credits in line (not scheduled on a fee yet). */
  waiting: number;
  /** The plan that receives the discounts. */
  target: { subscription: Subscription; plan: Plan; forWhom: Customer } | null;
  rules: ReferralRules;
}

export function referralSummary(s: Snapshot, customerId: string): ReferralSummary | null {
  const me = s.customers.find((c) => c.id === customerId);
  if (!me) return null;
  const today = dayKey(s.now);
  const holderId = me.holderId ?? me.id;
  const customers = new Map(s.customers.map((c) => [c.id, c]));
  const plans = new Map(s.plans.map((p) => [p.id, p]));
  const credits = referralCredits(s).filter((c) => c.beneficiaryId === holderId);
  const creditOf = new Map(credits.map((c) => [c.friendSubscriptionId, c]));
  const joined = s.subscriptions
    .filter((x) => x.referredByCustomerId && (customers.get(x.referredByCustomerId)?.holderId ?? x.referredByCustomerId) === holderId)
    .map((x) => ({ customer: customers.get(x.customerId)!, plan: plans.get(x.planId)!, since: dayKey(x.startedAt), credit: creditOf.get(x.id) ?? null }))
    .filter((x) => x.customer && x.plan)
    .sort((a, b) => b.since.localeCompare(a.since));
  const pending = s.leads
    .filter((l) => l.referrerCustomerId === customerId && !s.subscriptions.some((x) => x.customerId === l.customerId && x.status !== "canceled"))
    .map((l) => ({ customer: customers.get(l.customerId)!, plan: plans.get(l.planId)!, since: dayKey(l.createdAt) }))
    .filter((x) => x.customer && x.plan);
  const used = credits.filter((c) => c.usedOn && c.usedOn <= today);
  const upcoming = credits.filter((c) => c.usedOn && c.usedOn > today).sort((a, b) => a.usedOn!.localeCompare(b.usedOn!))[0];
  const targetSub = referralTarget(s, holderId);
  const targetPlan = targetSub ? plans.get(targetSub.planId) : null;
  return {
    code: me.referralCode,
    canRefer: me.holderId === null,
    joined,
    pending,
    usedCents: used.reduce((t, c) => t + c.amountCents, 0),
    next: upcoming && targetPlan ? { day: upcoming.usedOn!, discountCents: upcoming.amountCents, priceCents: targetPlan.priceCents } : null,
    waiting: credits.filter((c) => c.status === "queued" || c.status === "no_plan").length,
    target: targetSub && targetPlan ? { subscription: targetSub, plan: targetPlan, forWhom: customers.get(targetSub.customerId) ?? me } : null,
    rules: referralRules(s),
  };
}

export interface ReferralStats {
  joinedInRange: number;
  activeReferred: number;
  mrrFromReferralsCents: number;
  discountsInRangeCents: number;
  pendingLeads: number;
  topReferrers: { customer: Customer; count: number; mrrCents: number }[];
}

export function referralStats(s: Snapshot, r: { from: string; to: string }): ReferralStats {
  const plans = new Map(s.plans.map((p) => [p.id, p]));
  const customers = new Map(s.customers.map((c) => [c.id, c]));
  const referred = s.subscriptions.filter((x) => x.referredByCustomerId);
  const active = referred.filter((x) => x.status === "active");
  const byReferrer = new Map<string, Subscription[]>();
  for (const x of referred) (byReferrer.get(x.referredByCustomerId!) ?? byReferrer.set(x.referredByCustomerId!, []).get(x.referredByCustomerId!)!).push(x);
  return {
    joinedInRange: referred.filter((x) => inRange(x.startedAt, r)).length,
    activeReferred: active.length,
    mrrFromReferralsCents: active.reduce((t, x) => t + (plans.get(x.planId)?.priceCents ?? 0), 0),
    discountsInRangeCents: clubCharges(s, r).reduce((t, c) => t + c.discountCents, 0),
    pendingLeads: s.leads.filter((l) => l.referrerCustomerId && !s.subscriptions.some((x) => x.customerId === l.customerId && x.status !== "canceled")).length,
    topReferrers: [...byReferrer.entries()]
      .map(([id, subs]) => ({
        customer: customers.get(id)!,
        count: subs.length,
        mrrCents: subs.filter((x) => x.status === "active").reduce((t, x) => t + (plans.get(x.planId)?.priceCents ?? 0), 0),
      }))
      .filter((x) => x.customer)
      .sort((a, b) => b.count - a.count || b.mrrCents - a.mrrCents)
      .slice(0, 8),
  };
}

function lastBillingDay(billingDay: number, today: string): string {
  const m = today.slice(0, 7);
  const thisMonth = `${m}-${String(Math.min(billingDay, daysInMonth(m))).padStart(2, "0")}`;
  if (thisMonth <= today) return thisMonth;
  const prev = addMonths(m, -1);
  return `${prev}-${String(Math.min(billingDay, daysInMonth(prev))).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------------------
// Revenue per barber

export interface BarberRevenue {
  barber: Barber;
  unitName: string;
  completed: number;
  clubVisits: number;
  walkInCents: number;
  /** Share of the club revenue, split by the value of club services each barber delivered. */
  clubShareCents: number;
  productCents: number;
  totalCents: number;
  serviceCommissionCents: number;
  productCommissionCents: number;
  occupancy: number;
  plansSold: number;
}

export function barberRevenue(s: Snapshot, r: { from: string; to: string }, opts: { includeInactive?: boolean } = {}): BarberRevenue[] {
  const today = dayKey(s.now);
  const appts = s.appointments.filter((a) => inRange(a.startsAt, r));
  const completed = appts.filter((a) => a.status === "completed");
  const clubTotal = clubCharges(s, r).reduce((sum, c) => sum + c.amountCents, 0);
  const coveredTotal = completed.reduce((sum, a) => sum + a.coveredCents, 0);
  const units = new Map(s.units.map((u) => [u.id, u]));

  const rows = s.barbers
    .filter((b) => opts.includeInactive || b.active)
    .map((b) => {
      const mine = completed.filter((a) => a.barberId === b.id);
      const walkInCents = sum(mine, (a) => a.chargedCents);
      const covered = sum(mine, (a) => a.coveredCents);
      const clubShareCents = coveredTotal > 0 ? Math.round((clubTotal * covered) / coveredTotal) : 0;
      const productCents = sum(
        s.productSales.filter((x) => x.barberId === b.id && inRange(x.soldAt, r)),
        (x) => x.quantity * x.unitPriceCents,
      );
      const booked = sum(
        appts.filter((a) => a.barberId === b.id && a.status !== "canceled" && dayKey(a.startsAt) <= today),
        (a) => a.durationMin,
      );
      const unit = units.get(b.unitId);
      let open = 0;
      for (let d = r.from; d <= r.to && d <= today; d = addDays(d, 1)) {
        const h = unit?.hours[weekdayOf(d)];
        if (h) open += h.close - h.open;
      }
      return {
        barber: b,
        unitName: unit?.name ?? "",
        completed: mine.length,
        clubVisits: mine.filter((a) => a.coveredCents > 0).length,
        walkInCents,
        clubShareCents,
        productCents,
        totalCents: walkInCents + clubShareCents + productCents,
        serviceCommissionCents: Math.round((walkInCents + clubShareCents) * b.serviceCommission),
        productCommissionCents: Math.round(productCents * b.productCommission),
        occupancy: open > 0 ? Math.min(1, booked / open) : 0,
        plansSold: s.subscriptions.filter((x) => x.soldByBarberId === b.id && inRange(x.startedAt, r)).length,
      };
    });
  return rows.filter((x) => x.barber.active || x.completed > 0).sort((a, b) => b.totalCents - a.totalCents);
}

// ---------------------------------------------------------------------------------------
// Revenue mix

export interface RevenueMix {
  walkInCents: number;
  clubCents: number;
  productCents: number;
  totalCents: number;
  completed: number;
  walkInVisits: number;
  avgWalkInTicketCents: number;
  noShows: number;
}

export function revenueMix(s: Snapshot, r: { from: string; to: string }): RevenueMix {
  const appts = s.appointments.filter((a) => inRange(a.startsAt, r));
  const completed = appts.filter((a) => a.status === "completed");
  const walkIns = completed.filter((a) => a.chargedCents > 0);
  const walkInCents = sum(completed, (a) => a.chargedCents);
  const clubCents = sum(clubCharges(s, r), (c) => c.amountCents);
  const productCents = sum(
    s.productSales.filter((x) => inRange(x.soldAt, r)),
    (x) => x.quantity * x.unitPriceCents,
  );
  return {
    walkInCents,
    clubCents,
    productCents,
    totalCents: walkInCents + clubCents + productCents,
    completed: completed.length,
    walkInVisits: walkIns.length,
    avgWalkInTicketCents: walkIns.length ? Math.round(walkInCents / walkIns.length) : 0,
    noShows: appts.filter((a) => a.status === "no_show").length,
  };
}

// ---------------------------------------------------------------------------------------
// Club plans

export interface PlanIndicator {
  plan: Plan;
  members: number;
  paused: number;
  pastDue: number;
  mrrCents: number;
  newInRange: number;
  canceledInRange: number;
  share: number;
  /** Cancellations in the range over members at the start of the range. */
  churn: number;
  fromApp: number;
}

export function planIndicators(s: Snapshot, r: { from: string; to: string }): PlanIndicator[] {
  const totalMembers = s.subscriptions.filter(isMemberStatus).length;
  return [...s.plans]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((plan) => {
      const subs = s.subscriptions.filter((x) => x.planId === plan.id);
      const members = subs.filter(isMemberStatus).length;
      const atStart = subs.filter((x) => activeOn(x, addDays(r.from, -1))).length;
      const canceledInRange = subs.filter((x) => x.canceledAt && inRange(x.canceledAt, r)).length;
      return {
        plan,
        members,
        paused: subs.filter((x) => x.status === "paused").length,
        pastDue: subs.filter((x) => x.status === "past_due").length,
        mrrCents: subs.filter((x) => x.status === "active").length * plan.priceCents,
        newInRange: subs.filter((x) => inRange(x.startedAt, r)).length,
        canceledInRange,
        share: totalMembers ? members / totalMembers : 0,
        churn: atStart ? canceledInRange / atStart : 0,
        fromApp: subs.filter((x) => x.channel === "app" && isMemberStatus(x)).length,
      };
    });
}

export interface ClubTotals {
  members: number;
  dependents: number;
  mrrCents: number;
  newInRange: number;
  canceledInRange: number;
  pastDue: number;
  pastDueCents: number;
  paused: number;
  bestSeller: Plan | null;
}

export function clubTotals(s: Snapshot, r: { from: string; to: string }): ClubTotals {
  const plans = new Map(s.plans.map((p) => [p.id, p]));
  const members = s.subscriptions.filter(isMemberStatus);
  const pastDue = s.subscriptions.filter((x) => x.status === "past_due");
  const indicators = planIndicators(s, r);
  const best = [...indicators].sort((a, b) => b.members - a.members)[0];
  return {
    members: members.length,
    dependents: members.filter((x) => x.payerCustomerId !== x.customerId).length,
    mrrCents: sum(
      s.subscriptions.filter((x) => x.status === "active"),
      (x) => plans.get(x.planId)?.priceCents ?? 0,
    ),
    newInRange: s.subscriptions.filter((x) => inRange(x.startedAt, r)).length,
    canceledInRange: s.subscriptions.filter((x) => x.canceledAt && inRange(x.canceledAt, r)).length,
    pastDue: pastDue.length,
    pastDueCents: sum(pastDue, (x) => plans.get(x.planId)?.priceCents ?? 0),
    paused: s.subscriptions.filter((x) => x.status === "paused").length,
    bestSeller: best && best.members > 0 ? best.plan : null,
  };
}

/** Members and recurring revenue at the end of each of the last `months` months. */
export function memberHistory(s: Snapshot, months = 6): { month: string; members: number; mrrCents: number }[] {
  const plans = new Map(s.plans.map((p) => [p.id, p]));
  const today = dayKey(s.now);
  const current = today.slice(0, 7);
  const out = [];
  for (let i = months - 1; i >= 0; i--) {
    const month = addMonths(current, -i);
    const end = i === 0 ? today : `${month}-${String(daysInMonth(month)).padStart(2, "0")}`;
    const inForce = s.subscriptions.filter((x) => activeOn(x, end));
    out.push({ month, members: inForce.length, mrrCents: sum(inForce, (x) => plans.get(x.planId)?.priceCents ?? 0) });
  }
  return out;
}

/** Barbers ranked by plans sold in the range. */
export function plansSoldByBarber(s: Snapshot, r: { from: string; to: string }): { barber: Barber; count: number; mrrCents: number }[] {
  const plans = new Map(s.plans.map((p) => [p.id, p]));
  return s.barbers
    .filter((b) => b.active)
    .map((barber) => {
      const sold = s.subscriptions.filter((x) => x.soldByBarberId === barber.id && inRange(x.startedAt, r));
      return { barber, count: sold.length, mrrCents: sum(sold, (x) => plans.get(x.planId)?.priceCents ?? 0) };
    })
    .filter((x) => x.count > 0)
    .sort((a, b) => b.count - a.count || b.mrrCents - a.mrrCents);
}

// ---------------------------------------------------------------------------------------
// Automatic recommendations

export interface UpsellCandidate {
  customer: Customer;
  visitsPerMonth: number;
  monthlySpendCents: number;
  plan: Plan;
  monthlySavingCents: number;
  lastVisit: string;
}

/**
 * Customers without a plan who would pay less in the club: from what they spent on
 * club-coverable services in the last 90 days, pick the cheapest plan that covers what
 * they use and is cheaper than paying per visit.
 */
export function upsellCandidates(s: Snapshot, windowDays = 90): UpsellCandidate[] {
  const today = dayKey(s.now);
  const from = addDays(today, -windowDays + 1);
  const services = new Map(s.services.map((x) => [x.id, x]));
  const members = new Set(s.subscriptions.filter((x) => x.status !== "canceled").map((x) => x.customerId));
  const byCustomer = new Map<string, Appointment[]>();
  for (const a of s.appointments) {
    if (a.status !== "completed" || members.has(a.customerId)) continue;
    const k = dayKey(a.startsAt);
    if (k < from || k > today) continue;
    (byCustomer.get(a.customerId) ?? byCustomer.set(a.customerId, []).get(a.customerId)!).push(a);
  }
  const customers = new Map(s.customers.map((c) => [c.id, c]));
  const plans = [...s.plans].sort((a, b) => a.priceCents - b.priceCents);
  const out: UpsellCandidate[] = [];
  for (const [customerId, appts] of byCustomer) {
    const customer = customers.get(customerId);
    if (!customer) continue;
    let coverable = 0;
    const uses = new Set<string>();
    for (const a of appts) {
      for (const id of a.serviceIds) {
        const svc = services.get(id);
        if (svc?.coverage) {
          coverable += svc.priceCents;
          uses.add(svc.coverage);
        }
      }
    }
    if (!uses.size) continue;
    const monthly = Math.round((coverable * 30) / windowDays);
    const plan = plans.find((p) => [...uses].every((u) => p.covers.includes(u as Plan["covers"][number])));
    if (!plan || plan.priceCents >= monthly) continue;
    out.push({
      customer,
      visitsPerMonth: Math.round(((appts.length * 30) / windowDays) * 10) / 10,
      monthlySpendCents: monthly,
      plan,
      monthlySavingCents: monthly - plan.priceCents,
      lastVisit: dayKey(appts[appts.length - 1].startsAt),
    });
  }
  return out.sort((a, b) => b.monthlySavingCents - a.monthlySavingCents);
}

export interface RiskEntry {
  customer: Customer;
  subscription: Subscription;
  plan: Plan;
  reason: "past_due" | "late";
  daysSinceVisit: number | null;
  lateByDays: number;
}

/** Members whose card failed or who are well past their usual return. */
export function retentionRisk(s: Snapshot): RiskEntry[] {
  const today = dayKey(s.now);
  const plans = new Map(s.plans.map((p) => [p.id, p]));
  const customers = new Map(s.customers.map((c) => [c.id, c]));
  const lastVisit = new Map<string, string>();
  for (const a of s.appointments) {
    if (a.status !== "completed") continue;
    const k = dayKey(a.startsAt);
    if (k <= today && (lastVisit.get(a.customerId) ?? "") < k) lastVisit.set(a.customerId, k);
  }
  const hasUpcoming = new Set(s.appointments.filter((a) => a.status === "scheduled").map((a) => a.customerId));
  const out: RiskEntry[] = [];
  for (const sub of s.subscriptions) {
    if (!isMemberStatus(sub)) continue;
    const customer = customers.get(sub.customerId);
    const plan = plans.get(sub.planId);
    if (!customer || !plan) continue;
    const last = lastVisit.get(customer.id);
    const days = last ? daysBetween(last, today) : null;
    const late = days === null ? 0 : days - customer.cycleDays;
    if (sub.status === "past_due") {
      out.push({ customer, subscription: sub, plan, reason: "past_due", daysSinceVisit: days, lateByDays: Math.max(0, late) });
    } else if (days !== null && !hasUpcoming.has(customer.id) && days > Math.max(21, customer.cycleDays * 1.5)) {
      out.push({ customer, subscription: sub, plan, reason: "late", daysSinceVisit: days, lateByDays: late });
    }
  }
  return out.sort((a, b) => (a.reason === b.reason ? b.lateByDays - a.lateByDays : a.reason === "past_due" ? -1 : 1));
}

// ---------------------------------------------------------------------------------------
// Products

export interface ProductStat {
  product: Product;
  units: number;
  revenueCents: number;
  marginCents: number;
  lowStock: boolean;
  reserved: number;
}

export function productStats(s: Snapshot, r: { from: string; to: string }): ProductStat[] {
  return s.products
    .map((product) => {
      const sales = s.productSales.filter((x) => x.productId === product.id && inRange(x.soldAt, r));
      const units = sum(sales, (x) => x.quantity);
      const revenueCents = sum(sales, (x) => x.quantity * x.unitPriceCents);
      return {
        product,
        units,
        revenueCents,
        marginCents: revenueCents - units * product.costCents,
        lowStock: product.stock <= product.minStock,
        reserved: sum(
          s.reservations.filter((x) => x.productId === product.id && x.status === "reserved"),
          (x) => x.quantity,
        ),
      };
    })
    .sort((a, b) => b.revenueCents - a.revenueCents);
}

// ---------------------------------------------------------------------------------------
// Upcoming club charges

export function upcomingClubCharges(s: Snapshot, days = 30): { count: number; totalCents: number } {
  const today = dayKey(s.now);
  const end = addDays(today, days);
  const plans = new Map(s.plans.map((p) => [p.id, p]));
  const discounts = referralDiscounts(s);
  let count = 0;
  let totalCents = 0;
  for (const sub of s.subscriptions) {
    if (sub.status !== "active") continue;
    for (let m = today.slice(0, 7); m <= end.slice(0, 7); m = addMonths(m, 1)) {
      const day = billingDayIn(sub.billingDay, m);
      if (day > today && day <= end) {
        count++;
        totalCents += (plans.get(sub.planId)?.priceCents ?? 0) - (discounts.get(sub.id)?.get(day) ?? 0);
      }
    }
  }
  return { count, totalCents };
}

// ---------------------------------------------------------------------------------------
// Customer view

export interface CustomerSummary {
  customer: Customer;
  subscription: Subscription | null;
  plan: Plan | null;
  dependents: { customer: Customer; subscription: Subscription; plan: Plan }[];
  lastVisit: string | null;
  daysSinceVisit: number | null;
  nextSuggested: string | null;
  upcoming: Appointment[];
  history: Appointment[];
  /** Value of club-covered services in the last 12 months minus what the plans cost. */
  savedLast12MonthsCents: number;
  nextChargeDay: string | null;
  /** Referral discount on the holder's own next fee. */
  nextChargeDiscountCents: number;
  monthlyTotalCents: number;
}

export function customerSummary(s: Snapshot, customerId: string): CustomerSummary | null {
  const customer = s.customers.find((c) => c.id === customerId);
  if (!customer) return null;
  const today = dayKey(s.now);
  const plans = new Map(s.plans.map((p) => [p.id, p]));
  const customers = new Map(s.customers.map((c) => [c.id, c]));
  const subscription = s.subscriptions.find((x) => x.customerId === customerId && x.status !== "canceled") ?? null;
  const plan = subscription ? (plans.get(subscription.planId) ?? null) : null;
  const dependents = s.subscriptions
    .filter((x) => x.payerCustomerId === customerId && x.customerId !== customerId && x.status !== "canceled")
    .map((x) => ({ customer: customers.get(x.customerId)!, subscription: x, plan: plans.get(x.planId)! }))
    .filter((x) => x.customer && x.plan);

  const mine = s.appointments.filter((a) => a.customerId === customerId);
  const history = mine.filter((a) => a.status === "completed" && dayKey(a.startsAt) <= today).reverse();
  const upcoming = mine.filter((a) => a.status === "scheduled");
  const lastVisit = history[0] ? dayKey(history[0].startsAt) : null;

  const yearAgo = addDays(today, -365);
  const family = new Set([customerId, ...dependents.map((d) => d.customer.id)]);
  const covered = sum(
    s.appointments.filter((a) => family.has(a.customerId) && a.status === "completed" && dayKey(a.startsAt) >= yearAgo),
    (a) => a.coveredCents,
  );
  const paid = sum(
    clubCharges(s, { from: yearAgo, to: today }).filter((c) =>
      s.subscriptions.some((x) => x.id === c.subscriptionId && x.payerCustomerId === customerId),
    ),
    (c) => c.amountCents,
  );

  const nextChargeDay = subscription && subscription.status === "active" ? nextBillingDay(subscription.billingDay, today) : null;

  return {
    customer,
    subscription,
    plan,
    dependents,
    lastVisit,
    daysSinceVisit: lastVisit ? daysBetween(lastVisit, today) : null,
    nextSuggested: lastVisit ? addDays(lastVisit, customer.cycleDays) : null,
    upcoming,
    history,
    savedLast12MonthsCents: covered - paid,
    nextChargeDay,
    nextChargeDiscountCents: subscription && nextChargeDay ? (referralDiscounts(s).get(subscription.id)?.get(nextChargeDay) ?? 0) : 0,
    monthlyTotalCents: (plan?.priceCents ?? 0) + sum(dependents, (d) => d.plan.priceCents),
  };
}

function nextBillingDay(billingDay: number, today: string): string {
  const m = today.slice(0, 7);
  const thisMonth = `${m}-${String(Math.min(billingDay, daysInMonth(m))).padStart(2, "0")}`;
  if (thisMonth > today) return thisMonth;
  const next = addMonths(m, 1);
  return `${next}-${String(Math.min(billingDay, daysInMonth(next))).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------------------

function sum<T>(items: readonly T[], f: (x: T) => number): number {
  let total = 0;
  for (const x of items) total += f(x);
  return total;
}
