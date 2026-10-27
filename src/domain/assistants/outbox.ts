import type { Appointment, Customer, Snapshot } from "../types";
import { addDays, dayKey, daysBetween, fromLocal, localParts } from "../time";
import { retentionRisk } from "../metrics";
import { clubCandidates, type ClubCandidate } from "./candidates";
import { expectedReturn, visitStats } from "./history";
import { subscriptionRows, winBackList } from "./subscriptions";
import { gapsFor } from "./gap-fill";
import * as say from "./phrases";

/**
 * The WhatsApp assistant's outbox: every message the shop should send, by situation, built
 * from the data. WhatsApp is not connected yet, so each message is ready to open in the
 * owner's WhatsApp with one tap; once the official API is connected the same queue goes out
 * by itself at `sendAt`. Nothing is sent from here.
 */

export type Situation =
  | "reminder_eve"
  | "reminder_today"
  | "after_visit"
  | "no_show"
  | "walkin_due"
  | "member_late"
  | "card_declined"
  | "club_invite"
  | "plan_request"
  | "club_welcome"
  | "win_back"
  | "gap_offer";

/** Meta's billing categories: utility (reminders, billing) is cheap, marketing costs ~10x. */
export type MetaCategory = "utility" | "marketing";

export interface SituationInfo {
  label: string;
  /** When it goes out, in plain words. */
  when: string;
  category: MetaCategory;
  /** Minutes someone at the front desk spends doing it by hand (find the contact, write, send). */
  manualMinutes: number;
  /** Daily cap, so the shop never floods anyone. */
  dailyCap: number | null;
  /** On unless the owner turns it on; off ones are listed but not queued nor counted. */
  defaultOn: boolean;
}

export const SITUATIONS: Record<Situation, SituationInfo> = {
  reminder_eve: { label: "Lembrete na véspera", when: "Dia anterior, às 18h", category: "utility", manualMinutes: 1.5, dailyCap: null, defaultOn: true },
  reminder_today: { label: "Lembrete no dia", when: "2 horas antes (opcional: a véspera já confirma)", category: "utility", manualMinutes: 1, dailyCap: null, defaultOn: false },
  after_visit: { label: "Pós-atendimento", when: "1 hora depois, com a data do próximo", category: "utility", manualMinutes: 1.5, dailyCap: null, defaultOn: true },
  no_show: { label: "Faltou", when: "No mesmo dia, para remarcar", category: "utility", manualMinutes: 2, dailyCap: null, defaultOn: true },
  walkin_due: { label: "Hora do corte (avulso)", when: "Quando passa do ritmo de costume", category: "marketing", manualMinutes: 2, dailyCap: 10, defaultOn: true },
  member_late: { label: "Assinante sumido", when: "Bem além do ritmo e sem horário marcado", category: "utility", manualMinutes: 2, dailyCap: 8, defaultOn: true },
  card_declined: { label: "Cartão recusado", when: "No dia da recusa", category: "utility", manualMinutes: 3, dailyCap: null, defaultOn: true },
  club_invite: { label: "Convite para o clube", when: "Candidatos de alta chance, 1 vez a cada 30 dias", category: "marketing", manualMinutes: 3, dailyCap: 5, defaultOn: true },
  plan_request: { label: "Pedido de plano pelo app", when: "Assim que chega", category: "utility", manualMinutes: 3, dailyCap: null, defaultOn: true },
  club_welcome: { label: "Boas-vindas ao clube", when: "No dia da assinatura", category: "utility", manualMinutes: 2, dailyCap: null, defaultOn: true },
  gap_offer: { label: "Encaixe em horário vago", when: "Véspera, para horários livres do barbeiro de costume", category: "marketing", manualMinutes: 3, dailyCap: 10, defaultOn: true },
  win_back: { label: "Reconquista", when: "Ex-assinantes com boa chance de voltar, 1 vez", category: "marketing", manualMinutes: 3, dailyCap: 3, defaultOn: true },
};

export const SITUATION_ORDER = Object.keys(SITUATIONS) as Situation[];

/** Most urgent first: money already lost, people waiting for an answer, then the rest. */
const PRIORITY: Situation[] = ["card_declined", "plan_request", "no_show", "reminder_today", "reminder_eve", "member_late", "club_welcome", "after_visit", "gap_offer", "club_invite", "win_back", "walkin_due"];

export interface OutboxItem {
  id: string;
  situation: Situation;
  /** Who receives it (the holder, for someone they manage). */
  to: Customer;
  /** Who the message is about. */
  about: Customer;
  /** When it should go out (ISO). In the past = ready now. */
  sendAt: string;
  text: string;
}

/** Messages for the account holder when the person is managed by someone (a son, a father-in-law). */
function recipient(c: Customer, byId: Map<string, Customer>): Customer {
  return (c.holderId ? byId.get(c.holderId) : null) ?? c;
}

const iso = (day: string, minutes: number) => fromLocal(day, minutes).toISOString();

export function outboxToday(s: Snapshot): OutboxItem[] {
  const today = dayKey(s.now);
  const yesterday = addDays(today, -1);
  const tomorrow = addDays(today, 1);
  const nowMin = localParts(s.now).minutes;
  const n = say.namesFor(s);
  const byId = new Map(s.customers.map((c) => [c.id, c]));
  const plans = new Map(s.plans.map((p) => [p.id, p]));
  const stats = visitStats(s);
  const out: OutboxItem[] = [];
  const push = (item: Omit<OutboxItem, "id">) => out.push({ ...item, id: `${item.situation}-${item.about.id}-${item.sendAt.slice(0, 10)}` });

  // Reminders the evening before: one message per account and time (father and son together).
  const tomorrowAppts = s.appointments.filter((a) => a.status === "scheduled" && dayKey(a.startsAt) === tomorrow);
  const groups = new Map<string, Appointment[]>();
  for (const a of tomorrowAppts) {
    const c = byId.get(a.customerId);
    if (!c) continue;
    const key = `${recipient(c, byId).id}-${a.groupId ?? a.id}`;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(a);
  }
  for (const appts of groups.values()) {
    const about = byId.get(appts[0].customerId)!;
    const to = recipient(about, byId);
    push({ situation: "reminder_eve", to, about, sendAt: iso(today, 18 * 60), text: say.reminderEve(to, appts, s.customers, n) });
  }

  // Reminders on the day, 2 hours before, for what is still ahead.
  for (const a of s.appointments) {
    if (a.status !== "scheduled" || dayKey(a.startsAt) !== today) continue;
    const start = localParts(a.startsAt).minutes;
    if (start - 120 < nowMin - 30) continue;
    const about = byId.get(a.customerId);
    if (!about) continue;
    const to = recipient(about, byId);
    push({ situation: "reminder_today", to, about, sendAt: iso(today, start - 120), text: say.reminderToday(to, a, n) });
  }

  // After the visit and missed visits, from yesterday and today.
  for (const a of s.appointments) {
    const day = dayKey(a.startsAt);
    if (day !== today && day !== yesterday) continue;
    const about = byId.get(a.customerId);
    if (!about) continue;
    const to = recipient(about, byId);
    const end = localParts(a.startsAt).minutes + a.durationMin;
    if (a.status === "completed") {
      const st = stats.get(about.id);
      const nextDay = st && !st.next ? expectedReturn(st, about.cycleDays) : null;
      const sendAt = day === today ? iso(today, end + 60) : iso(today, 10 * 60);
      push({ situation: "after_visit", to, about, sendAt, text: say.afterVisit(to, a, nextDay, s.now, n) });
    } else if (a.status === "no_show") {
      push({ situation: "no_show", to, about, sendAt: day === today ? iso(today, end + 30) : iso(today, 9 * 60 + 30), text: say.noShow(to, a, s.now, n) });
    }
  }

  // Card declined and members who drifted away.
  for (const r of retentionRisk(s)) {
    const to = recipient(r.customer, byId);
    if (r.reason === "past_due") {
      push({ situation: "card_declined", to, about: r.customer, sendAt: iso(today, 10 * 60), text: say.cardDeclined(to, r.plan) });
    } else if (out.filter((x) => x.situation === "member_late").length < (SITUATIONS.member_late.dailyCap ?? Infinity)) {
      const st = stats.get(r.customer.id);
      push({ situation: "member_late", to, about: r.customer, sendAt: iso(today, 11 * 60), text: say.memberLate(to, r.plan, r.daysSinceVisit ?? 0, st?.mainBarberId ?? null, n) });
    }
  }

  // Club invitations: high-chance candidates with no visit booked (those get the offer in person).
  const candidates = clubCandidates(s);
  const invited = new Set<string>();
  for (const c of candidates) {
    if (c.chance !== "alta" || c.moment.kind === "scheduled") continue;
    if (invited.size >= (SITUATIONS.club_invite.dailyCap ?? Infinity)) break;
    invited.add(c.customer.id);
    push({ situation: "club_invite", to: c.decider, about: c.customer, sendAt: iso(today, 12 * 60), text: say.inviteMessage(c, n) });
  }

  // Walk-ins past their usual rhythm, with nothing booked (and not already invited today).
  const members = new Set(s.subscriptions.filter((x) => x.status !== "canceled").map((x) => x.customerId));
  const due = [...stats.values()]
    .filter((st) => !members.has(st.customerId) && !invited.has(st.customerId) && !st.next && st.visits >= 2 && st.lastVisit)
    .map((st) => ({ st, ret: expectedReturn(st, byId.get(st.customerId)?.cycleDays ?? 30)! }))
    .filter((x) => x.ret >= addDays(today, -3) && x.ret <= today)
    .sort((a, b) => a.ret.localeCompare(b.ret))
    .slice(0, SITUATIONS.walkin_due.dailyCap ?? undefined);
  for (const { st } of due) {
    const about = byId.get(st.customerId)!;
    const to = recipient(about, byId);
    push({ situation: "walkin_due", to, about, sendAt: iso(today, 10 * 60 + 30), text: say.walkInDue(to, st.daysSinceLast ?? 0, st.mainBarberId, n) });
  }

  // Empty chairs tomorrow: offer them to customers who usually come at that time.
  const gapOffers = gapsFor(s, tomorrow).flatMap((g) => g.offers.map((o) => ({ g, o })));
  for (const { g, o } of gapOffers.slice(0, SITUATIONS.gap_offer.dailyCap ?? undefined)) {
    if (out.some((x) => x.about.id === o.customer.id && (x.situation === "walkin_due" || x.situation === "member_late"))) continue;
    push({ situation: "gap_offer", to: o.to, about: o.customer, sendAt: iso(today, 17 * 60), text: say.gapOffer(o.to, o.customer, g.barber.id, tomorrow, o.start, s.now, n) });
  }

  // Former members with a good chance of coming back (a few a day, best first).
  for (const r of winBackList(subscriptionRows(s)).slice(0, SITUATIONS.win_back.dailyCap ?? undefined)) {
    const to = r.payer;
    push({ situation: "win_back", to, about: r.customer, sendAt: iso(today, 15 * 60), text: say.winBack(to, r.plan, r.months, r.visitsAfterCancel, n) });
  }

  // Plan requests still waiting, and new members.
  for (const l of s.leads) {
    if (s.subscriptions.some((x) => x.customerId === l.customerId && x.planId === l.planId && x.status !== "canceled")) continue;
    const about = byId.get(l.customerId);
    const to = byId.get(l.requestedById);
    const plan = plans.get(l.planId);
    if (!about || !to || !plan) continue;
    push({ situation: "plan_request", to, about, sendAt: l.createdAt, text: say.planRequest(to, about, plan) });
  }
  for (const sub of s.subscriptions) {
    if (sub.status !== "active" || daysBetween(dayKey(sub.startedAt), today) > 1) continue;
    const about = byId.get(sub.customerId);
    const plan = plans.get(sub.planId);
    if (!about || !plan) continue;
    const to = byId.get(sub.payerCustomerId) ?? about;
    push({ situation: "club_welcome", to, about, sendAt: sub.startedAt, text: say.clubWelcome(to, plan, n) });
  }

  // What is already due comes first, the most urgent situations on top; then the rest by time.
  const priority = (x: OutboxItem) => PRIORITY.indexOf(x.situation);
  const at = (x: OutboxItem) => (x.sendAt <= s.now ? s.now : x.sendAt);
  return out.filter((i) => SITUATIONS[i.situation].defaultOn).sort((a, b) => at(a).localeCompare(at(b)) || priority(a) - priority(b));
}

// ---------------------------------------------------------------------------------------

export interface OutboxVolume {
  situation: Situation;
  /** Messages in the last 30 days, from the shop's own history. */
  last30: number;
}

/**
 * How many messages each situation would have produced in the last 30 days. Reminders, visits
 * and no-shows are counted from the appointments; the others from today's lists, which is how
 * often they come up.
 */
export function outboxVolume30d(s: Snapshot, candidates: ClubCandidate[] = clubCandidates(s)): OutboxVolume[] {
  const today = dayKey(s.now);
  const from = addDays(today, -29);
  const inWindow = (iso: string) => {
    const k = dayKey(iso);
    return k >= from && k <= today;
  };
  const past = s.appointments.filter((a) => inWindow(a.startsAt) && a.startsAt <= s.now);
  const visitsBooked = new Set(past.filter((a) => a.status !== "canceled").map((a) => a.groupId ?? a.id)).size;
  const risk = retentionRisk(s);
  const stats = visitStats(s);
  const members = new Set(s.subscriptions.filter((x) => x.status !== "canceled").map((x) => x.customerId));
  const byId = new Map(s.customers.map((c) => [c.id, c]));
  const dueInWindow = [...stats.values()].filter((st) => {
    if (members.has(st.customerId) || st.visits < 2) return false;
    const ret = expectedReturn(st, byId.get(st.customerId)?.cycleDays ?? 30);
    return ret !== null && ret >= from && ret <= today;
  }).length;

  const counts: Record<Situation, number> = {
    reminder_eve: visitsBooked,
    reminder_today: visitsBooked,
    after_visit: past.filter((a) => a.status === "completed").length,
    no_show: past.filter((a) => a.status === "no_show").length,
    walkin_due: dueInWindow,
    member_late: risk.filter((r) => r.reason === "late").length,
    card_declined: risk.filter((r) => r.reason === "past_due").length,
    club_invite: candidates.filter((c) => c.chance === "alta").length,
    plan_request: s.leads.filter((l) => inWindow(l.createdAt)).length,
    club_welcome: s.subscriptions.filter((x) => inWindow(x.startedAt)).length,
    gap_offer: Math.min(SITUATIONS.gap_offer.dailyCap ?? 0, gapsFor(s).reduce((t, g) => t + g.offers.length, 0)) * 26,
    win_back: winBackList(subscriptionRows(s)).filter((r) => r.sub.canceledAt && inWindow(r.sub.canceledAt)).length,
  };
  return SITUATION_ORDER.map((situation) => ({ situation, last30: counts[situation] }));
}

export interface FrontDeskTime {
  messages: number;
  /** Minutes of front-desk work the messages take by hand. */
  minutes: number;
  /** Bookings that arrived by WhatsApp in the last 30 days: conversations a booking agent would handle. */
  whatsappBookings: number;
  /** Minutes those conversations take by hand. */
  bookingMinutes: number;
}

/** Minutes a booking conversation takes by hand on WhatsApp (ask, check the agenda, confirm). */
export const BOOKING_CHAT_MINUTES = 4;

export function frontDeskTime(s: Snapshot, volume: OutboxVolume[]): FrontDeskTime {
  const today = dayKey(s.now);
  const from = addDays(today, -29);
  const on = volume.filter((v) => SITUATIONS[v.situation].defaultOn);
  const messages = on.reduce((t, v) => t + v.last30, 0);
  const minutes = on.reduce((t, v) => t + v.last30 * SITUATIONS[v.situation].manualMinutes, 0);
  const whatsappBookings = new Set(
    s.appointments
      .filter((a) => a.channel === "whatsapp" && a.status !== "canceled")
      .filter((a) => {
        const k = dayKey(a.startsAt);
        return k >= from && k <= today;
      })
      .map((a) => a.groupId ?? a.id),
  ).size;
  return { messages, minutes: Math.round(minutes), whatsappBookings, bookingMinutes: whatsappBookings * BOOKING_CHAT_MINUTES };
}
