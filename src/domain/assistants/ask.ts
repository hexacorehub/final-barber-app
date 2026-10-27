import type { Snapshot } from "../types";
import { addDays, addMonths, dayKey, daysInMonth } from "../time";
import { barberRevenue, clubTotals, plansSoldByBarber, productStats, retentionRisk, revenueMix } from "../metrics";
import { formatInt, formatMoneyRound, formatPercent } from "../money";
import { scopeToUnit } from "../units";
import { clubCandidates } from "./candidates";
import { subscriptionRows } from "./subscriptions";

/**
 * "Perguntar": understands a question about the business with simple rules (keywords for the
 * metric, the period, the unit and the barber) and answers with numbers computed by the app.
 * A model can later take over the understanding part; the numbers keep coming from here.
 */

export type Intent =
  | "revenue"
  | "barber_ranking"
  | "plans_sold"
  | "members"
  | "cancellations"
  | "no_shows"
  | "occupancy"
  | "ticket"
  | "products"
  | "candidates"
  | "risk";

export interface AskPeriod {
  from: string;
  to: string;
  label: string;
}

export interface Answer {
  intent: Intent | "unknown";
  /** Short headline with the number. */
  title: string;
  /** One or two sentences that explain it. */
  text: string;
  rows: { label: string; value: string }[];
  href: string | null;
  /** What the question was read as, so the owner can check. */
  understood: string;
}

export const SUGGESTED_QUESTIONS = [
  "Quanto faturamos este mês?",
  "Quem mais vendeu plano este mês?",
  "Quantas faltas tivemos na semana?",
  "Qual barbeiro mais faturou no mês passado?",
  "Quantos assinantes temos?",
  "Quantos cancelaram nos últimos 30 dias?",
  "Qual a ocupação da agenda na Guarapiranga?",
  "Quais produtos mais venderam?",
  "Quem pode assinar o clube?",
  "Quantos assinantes estão em risco?",
];

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const INTENTS: [Intent, RegExp][] = [
  ["plans_sold", /\b(vend\w* (de )?planos?|planos? vendid\w*|vendeu (mais )?planos?|assinaturas? nova\w*|quem (mais )?vendeu)\b/],
  ["candidates", /\b(candidat\w*|pode\w* assinar|quem assinaria|potencia\w* (de )?assinante)/],
  ["risk", /\b(risco|sumid\w*|cartao recusad\w*|inadimpl\w*)\b/],
  ["cancellations", /\b(cancel\w*|sairam|perdemos)\b/],
  ["no_shows", /\b(falta\w*|faltou|faltaram|no show|nao (vieram|veio|apareceu))\b/],
  ["occupancy", /\b(ocupac\w*|agenda cheia|cadeira\w* vazia\w*|horarios? (livres|vagos))\b/],
  ["ticket", /\b(ticket|gasto medio|valor medio)\b/],
  ["products", /\b(produto\w*|pomada\w*|estoque|vitrine)\b/],
  ["barber_ranking", /\b(qual barbeiro|quem (mais )?(faturou|atendeu|trabalhou)|melhor barbeiro|ranking|por barbeiro)\b/],
  ["members", /\b(assinante\w*|membros?|clube|recorrente|mrr)\b/],
  ["revenue", /\b(fatur\w*|receita|vendemos|ganhamos|entrou|dinheiro)\b/],
];

export function readPeriod(q: string, now: string): AskPeriod {
  const today = dayKey(now);
  const month = today.slice(0, 7);
  const monthEnd = (m: string) => `${m}-${String(daysInMonth(m)).padStart(2, "0")}`;
  if (/\bhoje\b/.test(q)) return { from: today, to: today, label: "hoje" };
  if (/\bontem\b/.test(q)) return { from: addDays(today, -1), to: addDays(today, -1), label: "ontem" };
  if (/\b(mes passado|mes anterior|ultimo mes)\b/.test(q)) {
    const prev = addMonths(month, -1);
    return { from: `${prev}-01`, to: monthEnd(prev), label: "no mês passado" };
  }
  if (/\b(30 dias|ultimos 30)\b/.test(q)) return { from: addDays(today, -29), to: today, label: "nos últimos 30 dias" };
  if (/\b(semana|7 dias)\b/.test(q)) return { from: addDays(today, -6), to: today, label: "nos últimos 7 dias" };
  if (/\b(ano|12 meses)\b/.test(q)) return { from: addDays(today, -364), to: today, label: "nos últimos 12 meses" };
  return { from: `${month}-01`, to: today, label: "este mês" };
}

export function ask(s: Snapshot, question: string): Answer {
  const q = normalize(question);
  const intent = INTENTS.find(([, re]) => re.test(q))?.[0] ?? null;
  const period = readPeriod(q, s.now);
  const unit = s.units.find((u) => normalize(u.name).split(" ").some((w) => w.length > 3 && q.includes(w))) ?? null;
  const barber = s.barbers.find((b) => {
    const first = normalize(b.name).split(" ")[0];
    return first.length > 2 && new RegExp(`\\b${first}\\b`).test(q);
  });
  const scoped = scopeToUnit(s, unit?.id ?? null);
  const where = unit ? ` na ${unit.name}` : "";
  const understood = [intentLabel(intent), period.label, unit ? `unidade ${unit.name}` : null, barber ? barber.name : null].filter(Boolean).join(" · ");
  const base = { rows: [] as Answer["rows"], understood };

  switch (intent) {
    case "revenue": {
      if (barber) {
        const b = barberRevenue(scoped, period).find((x) => x.barber.id === barber.id);
        const total = b?.totalCents ?? 0;
        return {
          ...base,
          intent,
          title: `${barber.name}: ${formatMoneyRound(total)} ${period.label}`,
          text: `Soma o avulso, a parte do clube pelo que ele atendeu e os produtos que vendeu.`,
          rows: b
            ? [
                { label: "Avulso", value: formatMoneyRound(b.walkInCents) },
                { label: "Clube", value: formatMoneyRound(b.clubShareCents) },
                { label: "Produtos", value: formatMoneyRound(b.productCents) },
              ]
            : [],
          href: "/painel/barbeiros",
        };
      }
      const m = revenueMix(scoped, period);
      return {
        ...base,
        intent,
        title: `${formatMoneyRound(m.totalCents)} ${period.label}${where}`,
        text: `${formatInt(m.completed)} atendimentos concluídos. O clube responde por ${formatPercent(m.totalCents ? m.clubCents / m.totalCents : 0)} do total.`,
        rows: [
          { label: "Serviços avulsos", value: formatMoneyRound(m.walkInCents) },
          { label: "Mister Club", value: formatMoneyRound(m.clubCents) },
          { label: "Produtos", value: formatMoneyRound(m.productCents) },
        ],
        href: "/painel/financeiro",
      };
    }
    case "barber_ranking": {
      const by = /atend/.test(q) ? "completed" : "totalCents";
      const list = barberRevenue(scoped, period).sort((a, b) => (by === "completed" ? b.completed - a.completed : b.totalCents - a.totalCents));
      const top = list[0];
      if (!top) return noData(base, intent);
      return {
        ...base,
        intent,
        title: `${top.barber.name} ${by === "completed" ? `atendeu mais: ${formatInt(top.completed)}` : `faturou mais: ${formatMoneyRound(top.totalCents)}`}`,
        text: `Ranking ${period.label}${where}.`,
        rows: list.slice(0, 5).map((b) => ({ label: b.barber.name, value: by === "completed" ? `${formatInt(b.completed)} atend.` : formatMoneyRound(b.totalCents) })),
        href: "/painel/barbeiros",
      };
    }
    case "plans_sold": {
      const list = plansSoldByBarber(scoped, period);
      const total = list.reduce((t, x) => t + x.count, 0);
      const top = list[0];
      return {
        ...base,
        intent,
        title: top ? `${top.barber.name} vendeu mais: ${top.count} ${top.count === 1 ? "plano" : "planos"}` : `Nenhum plano vendido ${period.label}`,
        text: `${formatInt(total)} planos vendidos por barbeiros ${period.label}${where}, somando ${formatMoneyRound(list.reduce((t, x) => t + x.mrrCents, 0))} por mês.`,
        rows: list.slice(0, 5).map((x) => ({ label: x.barber.name, value: `${x.count} · +${formatMoneyRound(x.mrrCents)}/mês` })),
        href: "/painel/assinaturas",
      };
    }
    case "members": {
      const t = clubTotals(scoped, period);
      return {
        ...base,
        intent,
        title: `${formatInt(t.members)} assinantes · ${formatMoneyRound(t.mrrCents)} por mês`,
        text: `${period.label[0].toUpperCase()}${period.label.slice(1)}: ${t.newInRange} entraram e ${t.canceledInRange} cancelaram. ${t.pastDue} estão com o cartão recusado.`,
        rows: [
          { label: "Em contas de família", value: formatInt(t.dependents) },
          { label: "Pausados", value: formatInt(t.paused) },
        ],
        href: "/painel/clube",
      };
    }
    case "cancellations": {
      const rows = subscriptionRows(scoped).filter((r) => r.sub.canceledAt && dayKey(r.sub.canceledAt) >= period.from && dayKey(r.sub.canceledAt) <= period.to);
      const reasons = new Map<string, number>();
      for (const r of rows) reasons.set(r.sub.cancelReason ?? "Sem motivo informado", (reasons.get(r.sub.cancelReason ?? "Sem motivo informado") ?? 0) + 1);
      return {
        ...base,
        intent,
        title: `${formatInt(rows.length)} ${rows.length === 1 ? "cancelamento" : "cancelamentos"} ${period.label}`,
        text: rows.length ? `${rows.filter((r) => r.visitsAfterCancel > 0).length} deles continuam vindo pagando avulso: são os mais fáceis de trazer de volta.` : "Nenhum assinante saiu nesse período.",
        rows: [...reasons.entries()].sort((a, b) => b[1] - a[1]).map(([label, n]) => ({ label, value: formatInt(n) })),
        href: "/painel/assinaturas?status=canceled",
      };
    }
    case "no_shows": {
      const m = revenueMix(scoped, period);
      const booked = m.completed + m.noShows;
      return {
        ...base,
        intent,
        title: `${formatInt(m.noShows)} ${m.noShows === 1 ? "falta" : "faltas"} ${period.label}${where}`,
        text: `${formatPercent(booked ? m.noShows / booked : 0)} dos horários marcados. O lembrete na véspera pelo WhatsApp é o que mais ajuda a reduzir.`,
        rows: [],
        href: "/painel/whatsapp",
      };
    }
    case "occupancy": {
      const list = barberRevenue(scoped, period);
      const avg = list.length ? list.reduce((t, b) => t + b.occupancy, 0) / list.length : 0;
      return {
        ...base,
        intent,
        title: `Ocupação de ${formatPercent(avg)} ${period.label}${where}`,
        text: "Tempo atendido sobre o tempo aberto de cada barbeiro. Os horários vagos de amanhã estão em Barbeiros, no encaixe.",
        rows: list.sort((a, b) => a.occupancy - b.occupancy).slice(0, 5).map((b) => ({ label: b.barber.name, value: formatPercent(b.occupancy) })),
        href: "/painel/barbeiros#encaixe",
      };
    }
    case "ticket": {
      const m = revenueMix(scoped, period);
      return { ...base, intent, title: `Ticket médio avulso de ${formatMoneyRound(m.avgWalkInTicketCents)} ${period.label}${where}`, text: `${formatInt(m.walkInVisits)} visitas pagas na hora.`, rows: [], href: "/painel" };
    }
    case "products": {
      const list = productStats(scoped, period).filter((p) => p.units > 0);
      const low = productStats(scoped, period).filter((p) => p.lowStock && p.product.active);
      return {
        ...base,
        intent,
        title: list[0] ? `${list[0].product.name} lidera: ${list[0].units} un.` : `Nenhum produto vendido ${period.label}`,
        text: `${formatMoneyRound(list.reduce((t, p) => t + p.revenueCents, 0))} em produtos ${period.label}${where}.${low.length ? ` ${low.length} com estoque baixo.` : ""}`,
        rows: list.slice(0, 5).map((p) => ({ label: p.product.name, value: `${p.units} un. · ${formatMoneyRound(p.revenueCents)}` })),
        href: "/painel/produtos",
      };
    }
    case "candidates": {
      const list = clubCandidates(scoped);
      const likely = list.filter((c) => c.chance !== "baixa");
      return {
        ...base,
        intent,
        title: `${formatInt(likely.length)} clientes com chance alta ou média de assinar`,
        text: `${formatInt(list.length)} candidatos no total. Se os de chance alta e média assinarem, são ${formatMoneyRound(likely.reduce((t, c) => t + c.plan.priceCents, 0))} a mais por mês.`,
        rows: likely.slice(0, 5).map((c) => ({ label: c.customer.name, value: c.plan.name.replace("Mister Club ", "") })),
        href: "/painel/candidatos",
      };
    }
    case "risk": {
      const r = retentionRisk(scoped);
      const card = r.filter((x) => x.reason === "past_due");
      return {
        ...base,
        intent,
        title: `${formatInt(r.length)} assinantes em risco`,
        text: `${card.length} com o cartão recusado e ${r.length - card.length} sumidos, bem além do ritmo de costume.`,
        rows: r.slice(0, 5).map((x) => ({ label: x.customer.name, value: x.reason === "past_due" ? "Cartão recusado" : `${x.daysSinceVisit} dias sem vir` })),
        href: "/painel/assinaturas?status=risk",
      };
    }
    default:
      return {
        ...base,
        intent: "unknown",
        title: "Não entendi essa pergunta",
        text: "Pergunte sobre faturamento, barbeiros, planos vendidos, assinantes, cancelamentos, faltas, ocupação, ticket, produtos, candidatos ou risco. Dá para dizer o período (hoje, semana, mês passado) e a unidade.",
        href: null,
      };
  }
}

function noData(base: Pick<Answer, "rows" | "understood">, intent: Intent): Answer {
  return { ...base, intent, title: "Sem dados nesse período", text: "Tente outro período ou unidade.", href: null };
}

function intentLabel(i: Intent | null): string | null {
  const L: Record<Intent, string> = {
    revenue: "faturamento",
    barber_ranking: "ranking de barbeiros",
    plans_sold: "planos vendidos",
    members: "assinantes",
    cancellations: "cancelamentos",
    no_shows: "faltas",
    occupancy: "ocupação",
    ticket: "ticket médio",
    products: "produtos",
    candidates: "candidatos ao clube",
    risk: "assinantes em risco",
  };
  return i ? L[i] : null;
}
