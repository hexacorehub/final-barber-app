import type { Appointment, ClubCoverage, Customer, Snapshot } from "../types";
import { addDays, dayKey, daysBetween } from "../time";

/**
 * What each customer's visits say about their habits: how often they come, how regular they
 * are, who cuts their hair and what they spend on services the club can cover. Shared by the
 * assistants so every screen reads the same numbers.
 */
export interface VisitStats {
  customerId: string;
  /** Completed visits inside the window. */
  visits: number;
  /** Days the visits are spread over (at least 30; shorter for new customers). */
  spanDays: number;
  visitsPerMonth: number;
  lastVisit: string | null;
  daysSinceLast: number | null;
  /** Average days between visits; null with fewer than 2 visits. */
  avgGapDays: number | null;
  /** Spread of the gaps (standard deviation / average): 0 = like clockwork. null with fewer than 3 visits. */
  gapVariation: number | null;
  /** Barber who did most of the visits, and their share of them. */
  mainBarberId: string | null;
  mainBarberShare: number;
  /** Next scheduled appointment, if any. */
  next: Appointment | null;
  /** Monthly spend on services a plan can cover, split by coverage. */
  coverableMonthlyCents: Record<ClubCoverage, number>;
  /** Average value of the club-coverable services in one visit. */
  avgCoverableVisitCents: number;
}

export const STATS_WINDOW_DAYS = 90;

const statsCache = new WeakMap<Snapshot, Map<number, Map<string, VisitStats>>>();

export function visitStats(s: Snapshot, windowDays = STATS_WINDOW_DAYS): Map<string, VisitStats> {
  const cache = statsCache.get(s) ?? statsCache.set(s, new Map()).get(s)!;
  if (!cache.has(windowDays)) cache.set(windowDays, computeStats(s, windowDays));
  return cache.get(windowDays)!;
}

function computeStats(s: Snapshot, windowDays: number): Map<string, VisitStats> {
  const today = dayKey(s.now);
  const from = addDays(today, -windowDays + 1);
  const services = new Map(s.services.map((x) => [x.id, x]));
  const customers = new Map(s.customers.map((c) => [c.id, c]));
  const past = new Map<string, Appointment[]>();
  const next = new Map<string, Appointment>();

  for (const a of s.appointments) {
    if (a.status === "scheduled") {
      if (a.startsAt >= s.now) {
        const cur = next.get(a.customerId);
        if (!cur || a.startsAt < cur.startsAt) next.set(a.customerId, a);
      }
      continue;
    }
    if (a.status !== "completed") continue;
    const k = dayKey(a.startsAt);
    if (k < from || k > today) continue;
    (past.get(a.customerId) ?? past.set(a.customerId, []).get(a.customerId)!).push(a);
  }

  const out = new Map<string, VisitStats>();
  const ids = new Set([...past.keys(), ...next.keys()]);
  for (const id of ids) {
    const visits = (past.get(id) ?? []).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    const customer = customers.get(id);
    out.set(id, summarize(id, visits, next.get(id) ?? null, customer, today, windowDays, services));
  }
  return out;
}

function summarize(
  customerId: string,
  visits: Appointment[],
  next: Appointment | null,
  customer: Customer | undefined,
  today: string,
  windowDays: number,
  services: Map<string, Snapshot["services"][number]>,
): VisitStats {
  const knownDays = customer ? Math.min(windowDays, Math.max(1, daysBetween(dayKey(customer.createdAt), today) + 1)) : windowDays;
  const spanDays = Math.max(30, knownDays);
  const days = visits.map((v) => dayKey(v.startsAt));
  const gaps = days.slice(1).map((d, i) => daysBetween(days[i], d));
  const avgGap = gaps.length ? gaps.reduce((t, g) => t + g, 0) / gaps.length : null;
  let variation: number | null = null;
  if (gaps.length >= 2 && avgGap) {
    const sd = Math.sqrt(gaps.reduce((t, g) => t + (g - avgGap) ** 2, 0) / gaps.length);
    variation = sd / avgGap;
  }

  const byBarber = new Map<string, number>();
  const coverable: Record<ClubCoverage, number> = { haircut: 0, beard: 0 };
  for (const v of visits) {
    byBarber.set(v.barberId, (byBarber.get(v.barberId) ?? 0) + 1);
    for (const sid of v.serviceIds) {
      const svc = services.get(sid);
      if (svc?.coverage) coverable[svc.coverage] += svc.priceCents;
    }
  }
  const [mainBarberId, mainCount] = [...byBarber.entries()].sort((a, b) => b[1] - a[1])[0] ?? [null, 0];
  const perMonth = (cents: number) => Math.round((cents * 30) / spanDays);
  const last = days.at(-1) ?? null;

  return {
    customerId,
    visits: visits.length,
    spanDays,
    visitsPerMonth: Math.round(((visits.length * 30) / spanDays) * 10) / 10,
    lastVisit: last,
    daysSinceLast: last ? daysBetween(last, today) : null,
    avgGapDays: avgGap === null ? null : Math.round(avgGap),
    gapVariation: variation === null ? null : Math.round(variation * 100) / 100,
    mainBarberId,
    mainBarberShare: visits.length ? mainCount / visits.length : 0,
    next,
    coverableMonthlyCents: { haircut: perMonth(coverable.haircut), beard: perMonth(coverable.beard) },
    avgCoverableVisitCents: visits.length ? Math.round((coverable.haircut + coverable.beard) / visits.length) : 0,
  };
}

/** Day the customer is expected back: last visit + their own rhythm (or the profile's cycle). */
export function expectedReturn(st: VisitStats, cycleDays: number): string | null {
  if (!st.lastVisit) return null;
  return addDays(st.lastVisit, st.avgGapDays ?? cycleDays);
}
