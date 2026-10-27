import type { Snapshot } from "../types";
import { addDays, dayKey, daysBetween } from "../time";
import { visitStats } from "./history";

/**
 * The assistant's scoreboard: of the messages the owner opened from a suggestion, how many
 * led to something within 14 days (a new plan, a return visit, a fee paid), and what that is
 * worth. Only what happened after the message counts, and only once per person.
 */

export interface AssistantAction {
  id: string;
  /** The suggestion or WhatsApp situation it came from. */
  kind: string;
  customerId: string;
  at: string;
}

export type Outcome = "subscribed" | "came_back" | "paid" | null;

export interface ScoredAction {
  action: AssistantAction;
  outcome: Outcome;
  /** New monthly fee (subscribed), visit value (came back) or fee recovered (paid). */
  valueCents: number;
}

export interface Scoreboard {
  from: string;
  sent: number;
  results: number;
  newMrrCents: number;
  visitsCents: number;
  feesCents: number;
  items: ScoredAction[];
}

export const RESULT_WINDOW_DAYS = 14;

const WANTS_PLAN = new Set(["club_invite", "offer_in_person", "plan_request", "win_back"]);
const WANTS_VISIT = new Set(["member_late", "walkin_due", "gap_offer", "fill_gap", "no_show"]);
const WANTS_PAYMENT = new Set(["card_declined"]);

export function scoreboard(s: Snapshot, log: AssistantAction[], days = 30): Scoreboard {
  const today = dayKey(s.now);
  const from = addDays(today, -days + 1);
  const plans = new Map(s.plans.map((p) => [p.id, p]));
  const stats = visitStats(s);
  const seen = new Set<string>();
  const items: ScoredAction[] = [];

  for (const action of [...log].sort((a, b) => a.at.localeCompare(b.at))) {
    const day = dayKey(action.at);
    if (day < from || day > today) continue;
    const key = `${action.kind}-${action.customerId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const until = addDays(day, RESULT_WINDOW_DAYS);
    let outcome: Outcome = null;
    let valueCents = 0;
    if (WANTS_PLAN.has(action.kind)) {
      const sub = s.subscriptions.find((x) => x.customerId === action.customerId && dayKey(x.startedAt) >= day && dayKey(x.startedAt) <= until);
      if (sub) {
        outcome = "subscribed";
        valueCents = plans.get(sub.planId)?.priceCents ?? 0;
      }
    } else if (WANTS_VISIT.has(action.kind)) {
      const visit = s.appointments.find((a) => a.customerId === action.customerId && a.status !== "canceled" && a.status !== "no_show" && dayKey(a.startsAt) > day && dayKey(a.startsAt) <= until);
      if (visit) {
        outcome = "came_back";
        valueCents = visit.chargedCents || stats.get(action.customerId)?.avgCoverableVisitCents || 0;
      }
    } else if (WANTS_PAYMENT.has(action.kind)) {
      const sub = s.subscriptions.find((x) => x.customerId === action.customerId && x.status === "active");
      if (sub && daysBetween(day, today) >= 1) {
        outcome = "paid";
        valueCents = plans.get(sub.planId)?.priceCents ?? 0;
      }
    }
    items.push({ action, outcome, valueCents });
  }

  const done = items.filter((x) => x.outcome);
  return {
    from,
    sent: items.length,
    results: done.length,
    newMrrCents: done.filter((x) => x.outcome === "subscribed").reduce((t, x) => t + x.valueCents, 0),
    visitsCents: done.filter((x) => x.outcome === "came_back").reduce((t, x) => t + x.valueCents, 0),
    feesCents: done.filter((x) => x.outcome === "paid").reduce((t, x) => t + x.valueCents, 0),
    items: items.reverse(),
  };
}

/**
 * The demo's history of opened messages (there is no real one yet): built from what actually
 * happened in the demo data — some of the people who joined, came back or paid got a message a
 * few days before; plus messages that led to nothing, as in real life. Marked as simulated.
 */
export function demoActionLog(s: Snapshot): AssistantAction[] {
  const today = dayKey(s.now);
  const from = addDays(today, -28);
  const out: AssistantAction[] = [];
  const pick = (id: string, mod: number) => [...id].reduce((t, c) => (t * 31 + c.charCodeAt(0)) | 0, 3) % mod === 0;
  const at = (day: string) => `${day}T14:00:00.000Z`;
  for (const sub of s.subscriptions) {
    const start = dayKey(sub.startedAt);
    if (start < from || start > today || !pick(sub.id, 2)) continue;
    out.push({ id: `demo-inv-${sub.id}`, kind: "club_invite", customerId: sub.customerId, at: at(addDays(start, -3)) });
  }
  for (const a of s.appointments) {
    const day = dayKey(a.startsAt);
    if (a.status !== "completed" || day < from || day > today || a.subscriptionId || !pick(a.id, 23)) continue;
    out.push({ id: `demo-due-${a.id}`, kind: "walkin_due", customerId: a.customerId, at: at(addDays(day, -2)) });
  }
  // Fee reminders for members whose card was declined and who are paying again.
  for (const sub of s.subscriptions.filter((x) => x.status === "active" && dayKey(x.startedAt) < addDays(today, -60)).filter((x) => pick(x.id, 97)).slice(0, 4)) {
    out.push({ id: `demo-fee-${sub.id}`, kind: "card_declined", customerId: sub.customerId, at: at(addDays(today, -12)) });
  }
  // Messages with no answer.
  for (const c of s.customers.slice(40, 70)) out.push({ id: `demo-none-${c.id}`, kind: "club_invite", customerId: c.id, at: at(addDays(today, -10)) });
  return out.filter((x) => dayKey(x.at) >= from);
}
