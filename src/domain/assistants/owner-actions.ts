import type { Customer, Snapshot } from "../types";
import { addDays, dayKey, daysBetween } from "../time";
import { productStats, retentionRisk } from "../metrics";
import { clubCandidates, type ClubCandidate } from "./candidates";
import * as say from "./phrases";

/**
 * "Hoje na barbearia": what the owner should do today, ordered by the money involved.
 * Club money is counted as 3 monthly fees (what is lost if the member leaves, or gained in the
 * first quarter if the candidate joins), so a declined card and a new candidate compare fairly.
 */

export const MONTHS_AT_STAKE = 3;

export type ActionKind = "card_declined" | "member_late" | "offer_in_person" | "plan_request" | "club_invite" | "low_stock";

export interface OwnerAction {
  id: string;
  kind: ActionKind;
  /** Keep (members at risk) or win (new subscriptions). */
  money: "keep" | "win" | null;
  title: string;
  reason: string;
  valueCents: number;
  /** WhatsApp message, when the action is a message. */
  message: { to: Customer; text: string } | null;
  /** Screen with the details. */
  href: string;
}

export interface OwnerDay {
  actions: OwnerAction[];
  keepCents: number;
  winCents: number;
}

export function ownerDay(s: Snapshot, candidates: ClubCandidate[] = clubCandidates(s)): OwnerDay {
  const today = dayKey(s.now);
  const tomorrow = addDays(today, 1);
  const n = say.namesFor(s);
  const byId = new Map(s.customers.map((c) => [c.id, c]));
  const plans = new Map(s.plans.map((p) => [p.id, p]));
  const actions: OwnerAction[] = [];

  for (const r of retentionRisk(s)) {
    const to = (r.customer.holderId ? byId.get(r.customer.holderId) : null) ?? r.customer;
    const value = r.plan.priceCents * MONTHS_AT_STAKE;
    if (r.reason === "past_due") {
      actions.push({
        id: `card-${r.subscription.id}`,
        kind: "card_declined",
        money: "keep",
        title: `Cartão recusado: ${r.customer.name}`,
        reason: `${say.planShort(r.plan)} de ${say.first(r.customer.name)} não foi cobrado. Mandar o Pix hoje evita o cancelamento.`,
        valueCents: value,
        message: { to, text: say.cardDeclined(to, r.plan) },
        href: "/painel/clube#risco",
      });
    } else {
      actions.push({
        id: `late-${r.subscription.id}`,
        kind: "member_late",
        money: "keep",
        title: `${r.customer.name} sumiu`,
        reason: `Assina o ${say.planShort(r.plan)}, não vem há ${r.daysSinceVisit} dias (costuma vir a cada ${r.customer.cycleDays}) e não tem horário. Quem não usa o plano costuma cancelar.`,
        valueCents: value,
        message: { to, text: say.memberLate(to, r.plan, r.daysSinceVisit ?? 0, null, n) },
        href: "/painel/clube#risco",
      });
    }
  }

  for (const c of candidates) {
    if (c.chance === "baixa") continue;
    const value = c.plan.priceCents * MONTHS_AT_STAKE;
    if (c.moment.kind === "scheduled" && c.moment.startsAt && c.moment.day <= tomorrow) {
      actions.push({
        id: `offer-${c.customer.id}`,
        kind: "offer_in_person",
        money: "win",
        title: `Ofereça o clube a ${c.customer.name} ${say.dayWords(c.moment.day, s.now)} às ${say.timeOf(c.moment.startsAt)}`,
        reason: `${n.barber(c.moment.barberId)} atende. Sugestão de fala: ${say.counterScript(c)}`,
        valueCents: value,
        message: null,
        href: "/painel/candidatos",
      });
    } else if (c.chance === "alta" && c.moment.kind !== "scheduled") {
      actions.push({
        id: `invite-${c.customer.id}`,
        kind: "club_invite",
        money: "win",
        title: `Convide ${c.customer.name} para o ${say.planShort(c.plan)}`,
        reason: say.candidateReason(c, n),
        valueCents: value,
        message: { to: c.decider, text: say.inviteMessage(c, n) },
        href: "/painel/candidatos",
      });
    }
  }

  const members = new Set(s.subscriptions.filter((x) => x.status !== "canceled").map((x) => `${x.customerId}-${x.planId}`));
  for (const l of s.leads) {
    if (members.has(`${l.customerId}-${l.planId}`)) continue;
    const about = byId.get(l.customerId);
    const to = byId.get(l.requestedById);
    const plan = plans.get(l.planId);
    if (!about || !to || !plan) continue;
    const days = daysBetween(dayKey(l.createdAt), today);
    actions.push({
      id: `lead-${l.id}`,
      kind: "plan_request",
      money: "win",
      title: `Pedido de plano esperando: ${about.name}`,
      reason: `Pediu o ${say.planShort(plan)} pelo app ${days === 0 ? "hoje" : `há ${days} ${days === 1 ? "dia" : "dias"}`}. Falta confirmar e ativar a cobrança.`,
      valueCents: plan.priceCents * MONTHS_AT_STAKE,
      message: { to, text: say.planRequest(to, about, plan) },
      href: "/painel/clube#interessados",
    });
  }

  for (const p of productStats(s, { from: addDays(today, -29), to: today })) {
    if (!p.lowStock || !p.product.active) continue;
    actions.push({
      id: `stock-${p.product.id}`,
      kind: "low_stock",
      money: null,
      title: `Repor ${p.product.name}`,
      reason: `Restam ${p.product.stock} (mínimo ${p.product.minStock}); vendeu ${p.units} nos últimos 30 dias${p.reserved ? ` e há ${p.reserved} reservado${p.reserved > 1 ? "s" : ""} pelo app` : ""}.`,
      valueCents: 0,
      message: null,
      href: "/painel/produtos",
    });
  }

  const order: Record<ActionKind, number> = { card_declined: 0, plan_request: 1, offer_in_person: 2, member_late: 3, club_invite: 4, low_stock: 5 };
  actions.sort((a, b) => b.valueCents - a.valueCents || order[a.kind] - order[b.kind]);
  return {
    actions,
    keepCents: actions.filter((a) => a.money === "keep").reduce((t, a) => t + a.valueCents, 0),
    winCents: actions.filter((a) => a.money === "win").reduce((t, a) => t + a.valueCents, 0),
  };
}
