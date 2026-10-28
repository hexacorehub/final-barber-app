import type { Barber, Customer, Plan, SalesChannel, Snapshot, Subscription } from "../types";
import { addDays, dayKey, daysBetween } from "../time";
import { retentionRisk } from "../metrics";

/**
 * Every subscription, past and present, with what explains it: who sold it, through which
 * channel, who referred it, how long it lasted and how the person behaves now. The owner
 * filters it any way (by barber, with or without referral, canceled…) to see where members
 * come from, where they leave, and who is worth winning back.
 */

export type SubStatus = "active" | "risk" | "paused" | "canceled";

export interface SubRow {
  sub: Subscription;
  customer: Customer;
  /** Who pays (the holder, for someone in their account). */
  payer: Customer;
  plan: Plan;
  seller: Barber | null;
  referrer: Customer | null;
  status: SubStatus;
  /** Why it is at risk, when it is. */
  riskReason: "past_due" | "late" | null;
  /** Months between start and cancellation (or today). */
  months: number;
  lastVisit: string | null;
  daysSinceVisit: number | null;
  /** Completed visits after canceling (still comes, now paying per visit). */
  visitsAfterCancel: number;
  winBack: WinBack | null;
}

export interface WinBack {
  /** 0–100: recent cancellation, still visiting, long tenure. */
  score: number;
  chance: "alta" | "media" | "baixa";
}

export interface SubFilter {
  status?: SubStatus | "all";
  /** A barber id, or "none" for subscriptions sold without one. */
  seller?: string;
  referral?: "with" | "without";
  channel?: SalesChannel;
  plan?: string;
  /** Started (or, for canceled, ended) within the last N days. */
  days?: number;
}

/** Former members are worth a win-back message for this long after canceling. */
export const WIN_BACK_DAYS = 180;

export function subscriptionRows(s: Snapshot): SubRow[] {
  const today = dayKey(s.now);
  const customers = new Map(s.customers.map((c) => [c.id, c]));
  const plans = new Map(s.plans.map((p) => [p.id, p]));
  const barbers = new Map(s.barbers.map((b) => [b.id, b]));
  const risk = new Map(retentionRisk(s).map((r) => [r.subscription.id, r.reason]));
  const visits = new Map<string, string[]>();
  for (const a of s.appointments) {
    if (a.status !== "completed" || a.startsAt > s.now) continue;
    (visits.get(a.customerId) ?? visits.set(a.customerId, []).get(a.customerId)!).push(dayKey(a.startsAt));
  }

  const out: SubRow[] = [];
  for (const sub of s.subscriptions) {
    const customer = customers.get(sub.customerId);
    const plan = plans.get(sub.planId);
    if (!customer || !plan) continue;
    const mine = (visits.get(customer.id) ?? []).sort();
    const end = sub.canceledAt ? dayKey(sub.canceledAt) : today;
    const riskReason = risk.get(sub.id) ?? null;
    const status: SubStatus = sub.status === "canceled" ? "canceled" : sub.status === "paused" ? "paused" : riskReason ? "risk" : "active";
    const visitsAfterCancel = sub.canceledAt ? mine.filter((d) => d > end).length : 0;
    const row: SubRow = {
      sub,
      customer,
      payer: customers.get(sub.payerCustomerId) ?? customer,
      plan,
      seller: sub.soldByBarberId ? (barbers.get(sub.soldByBarberId) ?? null) : null,
      referrer: sub.referredByCustomerId ? (customers.get(sub.referredByCustomerId) ?? null) : null,
      status,
      riskReason,
      months: Math.max(0, Math.round(daysBetween(dayKey(sub.startedAt), end) / 30)),
      lastVisit: mine.at(-1) ?? null,
      daysSinceVisit: mine.length ? daysBetween(mine.at(-1)!, today) : null,
      visitsAfterCancel,
      winBack: null,
    };
    if (sub.canceledAt && daysBetween(end, today) <= WIN_BACK_DAYS) row.winBack = winBackScore(daysBetween(end, today), visitsAfterCancel, row.months);
    out.push(row);
  }
  // Someone who canceled and already has a new plan is not a former member any more.
  const current = new Set(s.subscriptions.filter((x) => x.status !== "canceled").map((x) => x.customerId));
  for (const r of out) if (r.status === "canceled" && current.has(r.customer.id)) r.winBack = null;
  return out.sort((a, b) => b.sub.startedAt.localeCompare(a.sub.startedAt));
}

export function winBackScore(daysSinceCancel: number, visitsAfterCancel: number, months: number): WinBack {
  const recency = daysSinceCancel <= 30 ? 40 : daysSinceCancel <= 90 ? 25 : 10;
  const stillComes = visitsAfterCancel >= 2 ? 35 : visitsAfterCancel === 1 ? 25 : 0;
  const tenure = months >= 6 ? 20 : months >= 3 ? 12 : 5;
  const score = Math.min(100, recency + stillComes + tenure);
  return { score, chance: score >= 70 ? "alta" : score >= 45 ? "media" : "baixa" };
}

export function filterRows(rows: SubRow[], f: SubFilter, now: string): SubRow[] {
  const from = f.days ? addDays(dayKey(now), -f.days + 1) : null;
  return rows.filter((r) => {
    if (f.status && f.status !== "all" && r.status !== f.status) return false;
    if (f.seller === "none" && r.seller) return false;
    if (f.seller && f.seller !== "none" && r.sub.soldByBarberId !== f.seller) return false;
    if (f.referral === "with" && !r.referrer) return false;
    if (f.referral === "without" && r.referrer) return false;
    if (f.channel && r.sub.channel !== f.channel) return false;
    if (f.plan && r.plan.id !== f.plan) return false;
    if (from) {
      const when = r.status === "canceled" && r.sub.canceledAt ? r.sub.canceledAt : r.sub.startedAt;
      if (dayKey(when) < from) return false;
    }
    return true;
  });
}

export interface SubSummary {
  count: number;
  /** Members today in the selection (active, at risk, paused). */
  current: number;
  canceled: number;
  /** Monthly fees of the active ones in the selection. */
  mrrCents: number;
  /** Average months as a member. */
  avgMonths: number;
  /** canceled / (everyone in the selection). */
  cancelShare: number;
  winBackHigh: number;
}

export function summarizeRows(rows: SubRow[]): SubSummary {
  const canceled = rows.filter((r) => r.status === "canceled").length;
  return {
    count: rows.length,
    current: rows.length - canceled,
    canceled,
    mrrCents: rows.filter((r) => r.sub.status === "active").reduce((t, r) => t + r.plan.priceCents, 0),
    avgMonths: rows.length ? Math.round((rows.reduce((t, r) => t + r.months, 0) / rows.length) * 10) / 10 : 0,
    cancelShare: rows.length ? canceled / rows.length : 0,
    winBackHigh: rows.filter((r) => r.winBack?.chance === "alta").length,
  };
}

/** Former members worth a message, best first. */
export function winBackList(rows: SubRow[]): SubRow[] {
  return rows.filter((r) => r.winBack && r.winBack.chance !== "baixa").sort((a, b) => b.winBack!.score - a.winBack!.score);
}

/** Who sold, as rows for a "by barber" breakdown, including "sem barbeiro". */
export function bySeller(rows: SubRow[], barbers: Barber[]): { id: string; name: string; current: number; canceled: number; mrrCents: number }[] {
  const out = new Map<string, { id: string; name: string; current: number; canceled: number; mrrCents: number }>();
  const add = (id: string, name: string, r: SubRow) => {
    const x = out.get(id) ?? { id, name, current: 0, canceled: 0, mrrCents: 0 };
    if (r.status === "canceled") x.canceled++;
    else x.current++;
    if (r.sub.status === "active") x.mrrCents += r.plan.priceCents;
    out.set(id, x);
  };
  const names = new Map(barbers.map((b) => [b.id, b.name]));
  for (const r of rows) add(r.sub.soldByBarberId ?? "none", r.sub.soldByBarberId ? (names.get(r.sub.soldByBarberId) ?? "Ex-barbeiro") : "Sem barbeiro", r);
  return [...out.values()].sort((a, b) => b.current - a.current);
}
