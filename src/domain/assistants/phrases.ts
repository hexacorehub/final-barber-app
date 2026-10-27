import type { Appointment, Customer, Plan, Snapshot } from "../types";
import { formatMoneyRound } from "../money";
import { dayKey, hhmm, localParts, shortDate, weekdayLong } from "../time";
import type { ClubCandidate } from "./candidates";

/**
 * The words the assistants use. Rules pick the facts; these functions only put them into
 * sentences, so a model can replace the wording later without touching a number.
 * Each situation has a few variations, chosen by the person (the same person always gets the
 * same one, so the demo is predictable).
 */

export const first = (name: string) => name.split(" ")[0];
const brl = formatMoneyRound;
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function pick<T>(seed: string, options: T[]): T {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return options[Math.abs(h) % options.length];
}

/** "Mister Club Corte Plus" → "Corte Plus" */
export function planShort(plan: Plan): string {
  return plan.name.replace(/^Mister Club /, "");
}

/** "hoje", "amanhã", "quinta (30 out)" */
export function dayWords(key: string, now: string): string {
  const today = dayKey(now);
  if (key === today) return "hoje";
  const t = new Date(Date.parse(`${today}T12:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  if (key === t) return "amanhã";
  return `${weekdayLong(key)} (${shortDate(key)})`;
}

export function timeOf(iso: string): string {
  const m = localParts(iso).minutes;
  return m % 60 ? hhmm(m).replace(":", "h") : `${m / 60}h`;
}

export interface Names {
  shop: string;
  barber: (id: string | null) => string;
  unit: (id: string) => string;
  services: (ids: string[]) => string;
}

export function namesFor(s: Snapshot): Names {
  const barbers = new Map(s.barbers.map((b) => [b.id, b.name.split(" ")[0]]));
  const units = new Map(s.units.map((u) => [u.id, u.name]));
  const services = new Map(s.services.map((x) => [x.id, x.name.toLowerCase()]));
  return {
    shop: s.shop.name,
    barber: (id) => (id ? (barbers.get(id) ?? "a equipe") : "a equipe"),
    unit: (id) => units.get(id) ?? "",
    services: (ids) => {
      const list = ids.map((id) => services.get(id) ?? "serviço");
      return list.length > 1 ? `${list.slice(0, -1).join(", ")} e ${list.at(-1)}` : list[0];
    },
  };
}

// ---------------------------------------------------------------------------------------
// Club candidates

/** Why this person is a candidate, in one or two sentences, for the owner. */
export function candidateReason(c: ClubCandidate, n: Names): string {
  const st = c.stats;
  const habit = `${plural(st.visits, "visita", "visitas")} em 90 dias (${st.visitsPerMonth.toLocaleString("pt-BR")} por mês)`;
  const barber = st.mainBarberId && st.mainBarberShare >= 0.6 ? `, quase sempre com ${n.barber(st.mainBarberId)}` : "";
  const plan = planShort(c.plan);
  const today = `Paga cerca de ${brl(c.payNowCents)} por mês`;
  const apart = leftOut(c);
  const inPlan = apart ? `no ${plan}, com ${apart} à parte,` : `no ${plan}`;
  if (c.segment === "saves") return `${habit}${barber}. ${today}; ${inPlan} pagaria ${brl(c.inPlanCents)}, ${brl(c.savingCents)} a menos.`;
  if (c.segment === "even") return `${habit}${barber}. ${today}; ${inPlan} fica ${brl(c.inPlanCents)}: o mesmo valor, fixo e sem pagar a cada visita.`;
  return `${habit}${barber}. ${today}; o ${plan} custa ${brl(c.plan.priceCents)} e compensa com ${breakEvenVisits(c)} por mês.`;
}

/** What the plan leaves out and is still paid per visit: "a barba", "o corte". */
export function leftOut(c: ClubCandidate): string | null {
  const use = c.stats.coverableMonthlyCents;
  const out = [];
  if (!c.plan.covers.includes("haircut") && use.haircut > 0) out.push("o corte");
  if (!c.plan.covers.includes("beard") && use.beard > 0) out.push("a barba");
  return out.length ? out.join(" e ") : null;
}

export function breakEvenVisits(c: ClubCandidate): string {
  const per = Math.max(1, c.stats.avgCoverableVisitCents);
  const n = Math.ceil(c.plan.priceCents / per);
  return plural(n, "visita", "visitas");
}

/** When and how to make the offer. */
export function momentText(c: ClubCandidate, n: Names, now: string): string {
  const m = c.moment;
  if (m.kind === "scheduled" && m.startsAt) return `Oferecer no balcão: ${dayWords(m.day, now)} às ${timeOf(m.startsAt)}, com ${n.barber(m.barberId)}`;
  if (m.kind === "overdue") return "Mensagem agora: já passou do ritmo de costume";
  return `Mensagem ${dayWords(m.day, now)}, uns dias antes do retorno`;
}

/** What the barber can say at the counter. */
export function counterScript(c: ClubCandidate): string {
  const plan = planShort(c.plan);
  const apart = leftOut(c);
  if (c.segment === "saves") return `"Você gasta uns ${brl(c.payNowCents)} por mês aqui. No ${plan}${apart ? `, com ${apart} à parte,` : ""} seriam ${brl(c.inPlanCents)}."`;
  if (c.segment === "even") return `"No ${plan} você paga ${brl(c.plan.priceCents)} fixo por mês, o mesmo que gasta hoje, sem acertar a cada visita."`;
  return `"Com ${breakEvenVisits(c)} por mês, o ${plan} já sai mais em conta."`;
}

/** WhatsApp invitation for the person who decides (the holder, for a dependent). */
export function inviteMessage(c: ClubCandidate, n: Names): string {
  const who = first(c.decider.name);
  const sign = `Aqui é o ${n.barber(c.offerBarberId)}, da ${n.shop}`;
  const whose = c.decider.id === c.customer.id ? "dos seus cortes" : `dos cortes do ${first(c.customer.name)}`;
  const plan = planShort(c.plan);
  if (c.segment === "saves") {
    return pick(`${c.customer.id}-invite`, [
      `Oi, ${who}! ${sign}. Fiz as contas ${whose} nos últimos meses: dá uns ${brl(c.payNowCents)} por mês. No Mister Club ${plan}${leftOut(c) ? `, com ${leftOut(c)} à parte,` : ""} seriam ${brl(c.inPlanCents)}, ${brl(c.savingCents)} a menos todo mês. Quer que eu ative?`,
      `Oi, ${who}! ${sign}. Pelo ritmo das visitas, no Mister Club ${plan} você pagaria ${brl(c.savingCents)} a menos por mês (hoje dá uns ${brl(c.payNowCents)}). Posso te mandar como funciona?`,
    ]);
  }
  if (c.segment === "even") {
    return pick(`${c.customer.id}-invite`, [
      `Oi, ${who}! ${sign}. Vi que você vem com frequência: no Mister Club ${plan} fica ${brl(c.plan.priceCents)} fixo por mês, praticamente o que você já gasta, sem pagar a cada visita. Quer saber mais?`,
      `Oi, ${who}! ${sign}. Com o seu ritmo, o Mister Club ${plan} sai pelo mesmo valor de hoje (${brl(c.plan.priceCents)} por mês), com valor fixo e agenda pelo app. Te explico?`,
    ]);
  }
  return pick(`${c.customer.id}-invite`, [
    `Oi, ${who}! ${sign}. Se você vier ${breakEvenVisits(c)} por mês, o Mister Club ${plan} (${brl(c.plan.priceCents)}) já sai mais em conta que pagar cada corte. Quer que eu te explique?`,
    `Oi, ${who}! ${sign}. Sabia que com ${breakEvenVisits(c)} por mês o Mister Club ${plan} compensa? Fica ${brl(c.plan.priceCents)} fixo. Posso te mandar os detalhes?`,
  ]);
}

// ---------------------------------------------------------------------------------------
// WhatsApp situations

export function reminderEve(to: Customer, appts: Appointment[], all: Customer[], n: Names): string {
  const who = first(to.name);
  const a = appts[0];
  const at = timeOf(a.startsAt);
  if (appts.length > 1) {
    const people = appts.map((x) => `${x.customerId === to.id ? "você" : first(all.find((c) => c.id === x.customerId)?.name ?? "")} com ${n.barber(x.barberId)}`).join(" e ");
    return `Oi, ${who}! Lembrete da ${n.shop}: amanhã às ${at}, ${people}, na unidade ${n.unit(a.unitId)}. Responda 1 para confirmar ou 2 para remarcar.`;
  }
  const forWhom = a.customerId === to.id ? "você tem" : `o ${first(all.find((c) => c.id === a.customerId)?.name ?? "")} tem`;
  return pick(`${to.id}-eve`, [
    `Oi, ${who}! Lembrete da ${n.shop}: amanhã às ${at} ${forWhom} ${n.services(a.serviceIds)} com ${n.barber(a.barberId)}, na unidade ${n.unit(a.unitId)}. Responda 1 para confirmar ou 2 para remarcar.`,
    `Oi, ${who}! Tudo certo para amanhã às ${at}? ${forWhom === "você tem" ? "Você" : forWhom.replace(" tem", "")} com ${n.barber(a.barberId)} (${n.services(a.serviceIds)}). Responda 1 para confirmar ou 2 para remarcar.`,
  ]);
}

export function reminderToday(to: Customer, a: Appointment, n: Names): string {
  return pick(`${to.id}-today`, [
    `Oi, ${first(to.name)}! Te esperamos hoje às ${timeOf(a.startsAt)} com ${n.barber(a.barberId)}, na unidade ${n.unit(a.unitId)}. Até já!`,
    `${first(to.name)}, seu horário é hoje às ${timeOf(a.startsAt)} com ${n.barber(a.barberId)}. Se precisar remarcar, é só responder aqui.`,
  ]);
}

export function afterVisit(to: Customer, a: Appointment, nextDay: string | null, now: string, n: Names): string {
  const next = nextDay ? ` Pelo seu ritmo, o próximo seria ${dayWords(nextDay, now)}. Quer que eu já reserve?` : "";
  return pick(`${to.id}-after`, [
    `Valeu pela visita, ${first(to.name)}! Como ficou o trabalho do ${n.barber(a.barberId)}?${next}`,
    `${first(to.name)}, obrigado por vir hoje! Se puder, conta pra gente de 1 a 5 como foi.${next}`,
  ]);
}

export function noShow(to: Customer, a: Appointment, now: string, n: Names): string {
  return `Oi, ${first(to.name)}, sentimos sua falta ${dayWords(dayKey(a.startsAt), now)} às ${timeOf(a.startsAt)} com ${n.barber(a.barberId)}. Aconteceu alguma coisa? Posso remarcar para você.`;
}

export function walkInDue(to: Customer, days: number, barberId: string | null, n: Names): string {
  return pick(`${to.id}-due`, [
    `Oi, ${first(to.name)}! Já faz ${days} dias do seu último corte com ${n.barber(barberId)}. Quer que eu veja um horário essa semana?`,
    `${first(to.name)}, tá chegando a hora do corte! ${n.barber(barberId)} tem horários essa semana. Quer que eu reserve?`,
  ]);
}

export function memberLate(to: Customer, plan: Plan, days: number, barberId: string | null, n: Names): string {
  return `Oi, ${first(to.name)}! Seu Mister Club ${planShort(plan)} está ativo e faz ${days} dias que você não vem. Quer que eu reserve um horário com ${n.barber(barberId)} essa semana?`;
}

export function cardDeclined(to: Customer, plan: Plan): string {
  return `Oi, ${first(to.name)}! A mensalidade do Mister Club ${planShort(plan)} não passou no cartão. Posso te mandar um Pix ou você prefere atualizar o cartão pelo app?`;
}

export function planRequest(to: Customer, forWhom: Customer, plan: Plan): string {
  const other = forWhom.id !== to.id ? ` para o ${first(forWhom.name)}` : "";
  return `Oi, ${first(to.name)}! Recebemos pelo app o pedido do Mister Club ${planShort(plan)}${other}. Posso confirmar e ativar a cobrança?`;
}

export function clubWelcome(to: Customer, plan: Plan, n: Names): string {
  const covers = plan.covers.map((c) => (c === "haircut" ? "corte" : "barba")).join(" e ");
  return `Bem-vindo ao Mister Club ${planShort(plan)}, ${first(to.name)}! A partir de agora ${covers} ${plan.covers.length > 1 ? "estão incluídos" : "está incluído"}. Agende pelo app quando quiser. Qualquer dúvida, é só chamar aqui. Equipe ${n.shop}`;
}
