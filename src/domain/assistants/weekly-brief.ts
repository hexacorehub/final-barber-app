import type { Snapshot } from "../types";
import { addDays, dayKey } from "../time";
import { clubTotals, revenueMix } from "../metrics";
import { formatInt, formatMoneyRound, formatPercent } from "../money";
import { ownerDay, type OwnerAction } from "./owner-actions";

/**
 * The week in a few lines: the last 7 days against the 7 before, and the three things worth
 * doing first. Every number comes from the metrics; `headline` is the sentence a model may
 * rewrite later (it gets the same numbers and must keep them).
 */
export interface BriefFact {
  label: string;
  now: string;
  before: string;
  /** Relative change; null when there is nothing to compare with. */
  change: number | null;
  /** Whether going up is good news. */
  upIsGood: boolean;
}

export interface WeeklyBrief {
  from: string;
  to: string;
  facts: BriefFact[];
  headline: string;
  /** Numbers the headline quotes (a rewrite must keep all of them). */
  numbers: string[];
  priorities: OwnerAction[];
}

export function weeklyBrief(s: Snapshot): WeeklyBrief {
  const today = dayKey(s.now);
  const week = { from: addDays(today, -6), to: today };
  const prev = { from: addDays(today, -13), to: addDays(today, -7) };
  const a = revenueMix(s, week);
  const b = revenueMix(s, prev);
  const ca = clubTotals(s, week);
  const cb = clubTotals(s, prev);
  const change = (x: number, y: number) => (y ? (x - y) / y : null);
  const facts: BriefFact[] = [
    { label: "Faturamento", now: formatMoneyRound(a.totalCents), before: formatMoneyRound(b.totalCents), change: change(a.totalCents, b.totalCents), upIsGood: true },
    { label: "Atendimentos", now: formatInt(a.completed), before: formatInt(b.completed), change: change(a.completed, b.completed), upIsGood: true },
    { label: "Faltas", now: formatInt(a.noShows), before: formatInt(b.noShows), change: change(a.noShows, b.noShows), upIsGood: false },
    { label: "Novos assinantes", now: formatInt(ca.newInRange), before: formatInt(cb.newInRange), change: change(ca.newInRange, cb.newInRange), upIsGood: true },
    { label: "Cancelamentos", now: formatInt(ca.canceledInRange), before: formatInt(cb.canceledInRange), change: change(ca.canceledInRange, cb.canceledInRange), upIsGood: false },
    { label: "Ticket médio avulso", now: formatMoneyRound(a.avgWalkInTicketCents), before: formatMoneyRound(b.avgWalkInTicketCents), change: change(a.avgWalkInTicketCents, b.avgWalkInTicketCents), upIsGood: true },
  ];
  const rev = change(a.totalCents, b.totalCents);
  const total = formatMoneyRound(a.totalCents);
  const pct = rev === null ? null : formatPercent(Math.abs(rev));
  const net = ca.newInRange - ca.canceledInRange;
  const headline =
    `Nos últimos 7 dias a barbearia faturou ${total}` +
    (pct ? `, ${rev! >= 0 ? `${pct} a mais` : `${pct} a menos`} que na semana anterior` : "") +
    `. O clube ${net >= 0 ? `ganhou ${formatInt(net)}` : `perdeu ${formatInt(-net)}`} ${Math.abs(net) === 1 ? "assinante" : "assinantes"} no saldo da semana.`;
  return {
    from: week.from,
    to: week.to,
    facts,
    headline,
    numbers: [total, ...(pct ? [pct] : []), formatInt(Math.abs(net))],
    // One per kind, so the three are three different things to do.
    priorities: ownerDay(s)
      .actions.filter((x) => x.valueCents > 0)
      .filter((x, i, all) => all.findIndex((y) => y.kind === x.kind) === i)
      .slice(0, 3),
  };
}
