import type { Customer, Snapshot } from "../types";
import { addDays, dayKey, daysBetween, hhmm } from "../time";
import { productStats, retentionRisk } from "../metrics";
import { clubCandidates, type ClubCandidate } from "./candidates";
import * as say from "./phrases";
import { subscriptionRows, winBackList } from "./subscriptions";
import { gapsFor } from "./gap-fill";

/**
 * "Hoje na barbearia": what the owner should do today, ordered by the money involved.
 * Club money is counted as 3 monthly fees (what is lost if the member leaves, or gained in the
 * first quarter if the candidate joins), so a declined card and a new candidate compare fairly.
 */

export const MONTHS_AT_STAKE = 3;

export type ActionKind = "card_declined" | "member_late" | "offer_in_person" | "plan_request" | "club_invite" | "win_back" | "fill_gap" | "low_stock";

export interface OwnerAction {
  id: string;
  kind: ActionKind;
  /** Keep (members at risk) or win (new subscriptions). */
  money: "keep" | "win" | null;
  title: string;
  reason: string;
  valueCents: number;
  /** WhatsApp message, when the action is a message. */
  message: { to: Customer; aboutId: string; text: string } | null;
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
        message: { to, aboutId: r.customer.id, text: say.cardDeclined(to, r.plan) },
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
        message: { to, aboutId: r.customer.id, text: say.memberLate(to, r.plan, r.daysSinceVisit ?? 0, null, n) },
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
        message: { to: c.decider, aboutId: c.customer.id, text: say.inviteMessage(c, n) },
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
      message: { to, aboutId: about.id, text: say.planRequest(to, about, plan) },
      href: "/painel/clube#interessados",
    });
  }

  for (const r of winBackList(subscriptionRows(s)).filter((x) => x.winBack?.chance === "alta")) {
    const days = r.sub.canceledAt ? daysBetween(dayKey(r.sub.canceledAt), today) : 0;
    actions.push({
      id: `winback-${r.sub.id}`,
      kind: "win_back",
      money: "win",
      title: `Traga ${r.customer.name} de volta`,
      reason: `Cancelou o ${say.planShort(r.plan)} há ${days} dias, depois de ${r.months} meses${r.visitsAfterCancel ? `, e voltou ${r.visitsAfterCancel} ${r.visitsAfterCancel === 1 ? "vez" : "vezes"} pagando avulso` : ""}${r.sub.cancelReason ? `. Motivo: ${r.sub.cancelReason.toLowerCase()}` : ""}.`,
      valueCents: r.plan.priceCents * MONTHS_AT_STAKE,
      message: { to: r.payer, aboutId: r.customer.id, text: say.winBack(r.payer, r.plan, r.months, r.visitsAfterCancel, n) },
      href: "/painel/assinaturas?status=canceled",
    });
  }

  for (const g of gapsFor(s, tomorrow)) {
    if (!g.offers.length) continue;
    const o = g.offers[0];
    const hours = Math.round((g.freeMinutes / 60) * 10) / 10;
    actions.push({
      id: `gap-${g.barber.id}`,
      kind: "fill_gap",
      money: "win",
      title: `${g.barber.name.split(" ")[0]} tem ${hours.toLocaleString("pt-BR")} h livres amanhã`,
      reason: `${g.offers.length} ${g.offers.length === 1 ? "cliente dele está" : "clientes dele estão"} no ponto de voltar e costumam vir nesse horário. Comece por ${say.first(o.customer.name)}, às ${hhmm(o.start)}.`,
      valueCents: g.offers.reduce((t, x) => t + x.visitCents, 0),
      message: { to: o.to, aboutId: o.customer.id, text: say.gapOffer(o.to, o.customer, g.barber.id, tomorrow, o.start, s.now, n) },
      href: "/painel/barbeiros#encaixe",
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

  const order: Record<ActionKind, number> = { card_declined: 0, plan_request: 1, offer_in_person: 2, member_late: 3, club_invite: 4, win_back: 5, fill_gap: 6, low_stock: 7 };
  actions.sort((a, b) => b.valueCents - a.valueCents || order[a.kind] - order[b.kind]);
  return {
    actions,
    keepCents: actions.filter((a) => a.money === "keep").reduce((t, a) => t + a.valueCents, 0),
    winCents: actions.filter((a) => a.money === "win").reduce((t, a) => t + a.valueCents, 0),
  };
}
