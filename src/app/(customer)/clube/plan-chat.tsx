"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { RotateCcw, Sparkles } from "lucide-react";
import { formatMoney, formatMoneyRound } from "@/domain/money";
import { planAdvice, recommendedPlan, type Prices } from "@/domain/plan-advice";
import type { Plan } from "@/domain/types";
import { buttonStyles, cn } from "@/components/ui";

export interface ChatPerson {
  id: string;
  firstName: string;
  isSelf: boolean;
  currentPlanId: string | null;
  /** From the visit history, when there is enough of it. */
  history: { haircuts: number; beards: number } | null;
}

export interface FamilyRow {
  name: string;
  current: string | null;
  suggested: string | null;
  todayCents: number;
  suggestedCents: number;
}

const CUT_OPTIONS = [
  { label: "Toda semana", value: 4 },
  { label: "A cada 15 dias", value: 2 },
  { label: "Uma vez por mês", value: 1 },
  { label: "Não corto aqui", value: 0 },
];
const BEARD_OPTIONS = (cuts: number) => [
  { label: "Não faço", value: 0 },
  { label: "Junto com o corte", value: cuts },
  { label: "Uma vez por mês", value: 1 },
  { label: "Toda semana", value: 4 },
];

const short = (name: string) => name.replace("Mister Club ", "");

/** The plan consultant as a short conversation: who, how often, beard — then the answer with the math. */
export function PlanChat({ people, plans, prices, family, canChooseForOthers }: { people: ChatPerson[]; plans: Plan[]; prices: Prices; family: { rows: FamilyRow[]; todayCents: number; suggestedCents: number } | null; canChooseForOthers: boolean }) {
  const [who, setWho] = useState<string | null>(people.length === 1 ? people[0].id : null);
  const [cuts, setCuts] = useState<number | null>(null);
  const [beards, setBeards] = useState<number | null>(null);
  const person = people.find((p) => p.id === who) ?? null;
  const family_ = who === "familia";
  const name = person ? (person.isSelf ? "você" : person.firstName) : "";

  const answer = useMemo(() => {
    if (!person || cuts === null || beards === null) return null;
    const usage = { haircuts: cuts, beards };
    const current = plans.find((p) => p.id === person.currentPlanId) ?? null;
    const list = plans.map((plan) => ({ plan, advice: planAdvice(plan, usage, prices, { currentPlan: current, known: true }) }));
    const best = recommendedPlan(list);
    const pick = list.find((x) => x.plan.id === best) ?? null;
    return { pick, current, today: list[0]?.advice.todayCents ?? 0 };
  }, [person, cuts, beards, plans, prices]);

  const reset = () => {
    setWho(people.length === 1 ? people[0].id : null);
    setCuts(null);
    setBeards(null);
  };

  return (
    <section className="flex flex-col gap-3 rounded-2xl border-[1.5px] border-ink p-4 md:p-5" aria-label="Consultor de plano">
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
          <Sparkles size={18} aria-hidden="true" /> Qual plano é o meu?
        </h2>
        {who || cuts !== null ? (
          <button type="button" onClick={reset} className="inline-flex min-h-10 items-center gap-1 rounded-lg px-2 text-[13px] font-semibold hover:bg-chip">
            <RotateCcw size={14} aria-hidden="true" /> Recomeçar
          </button>
        ) : null}
      </div>

      {people.length > 1 ? (
        <Step question="Para quem é o plano?">
          {people.map((p) => (
            <Chip key={p.id} active={who === p.id} onClick={() => (setWho(p.id), setCuts(null), setBeards(null))} label={p.isSelf ? "Para mim" : p.firstName} />
          ))}
          {canChooseForOthers && family ? <Chip active={family_} onClick={() => (setWho("familia"), setCuts(null), setBeards(null))} label="Toda a família" /> : null}
        </Step>
      ) : null}

      {family_ && family ? (
        <Bubble>
          <p>Pelo histórico de cada um, este é o plano que melhor se encaixa:</p>
          <ul className="mt-2 flex flex-col divide-y divide-line-soft rounded-xl bg-white">
            {family.rows.map((r) => (
              <li key={r.name} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                <span className="font-semibold">{r.name}</span>
                <span className="text-[13px]">
                  {r.suggested ? short(r.suggested) : "Pagar cada visita"}
                  {r.current && r.suggested && r.current !== r.suggested ? <span className="text-muted"> (hoje: {short(r.current)})</span> : r.current === r.suggested && r.current ? <span className="text-muted"> (já é o seu)</span> : null}
                </span>
                <span className="text-[13px] font-semibold">{formatMoneyRound(r.suggestedCents)}/mês</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm">
            A conta da família fica em <strong>{formatMoneyRound(family.suggestedCents)} por mês</strong>
            {family.suggestedCents < family.todayCents ? `, ${formatMoneyRound(family.todayCents - family.suggestedCents)} a menos que hoje.` : family.suggestedCents > family.todayCents ? `, ${formatMoneyRound(family.suggestedCents - family.todayCents)} a mais que hoje, com mais coisas cobertas.` : ", o mesmo que hoje."}
          </p>
        </Bubble>
      ) : null}

      {person ? (
        <Step question={`Com que frequência ${person.isSelf ? "você corta" : `${person.firstName} corta`} o cabelo?`} hint={person.history ? `Pelo histórico: ${person.history.haircuts} por mês` : undefined}>
          {CUT_OPTIONS.map((o) => (
            <Chip key={o.label} active={cuts === o.value} onClick={() => (setCuts(o.value), setBeards(null))} label={o.label} highlight={person.history?.haircuts === o.value} />
          ))}
        </Step>
      ) : null}

      {person && cuts !== null ? (
        <Step question="E a barba?" hint={person.history ? `Pelo histórico: ${person.history.beards} por mês` : undefined}>
          {BEARD_OPTIONS(cuts).map((o) => (
            <Chip key={o.label} active={beards === o.value} onClick={() => setBeards(o.value)} label={o.label} highlight={person.history?.beards === o.value} />
          ))}
        </Step>
      ) : null}

      {answer ? (
        <Bubble>
          {answer.pick ? (
            <>
              <p>
                Para {name}, o melhor é o <strong>{short(answer.pick.plan.name)}</strong>: {formatMoney(answer.pick.plan.priceCents)} por mês.
              </p>
              <p className="mt-1 text-sm text-ink-soft">{answer.pick.advice.message}</p>
              {answer.current?.id !== answer.pick.plan.id ? (
                <Link href={`/clube/assinar/${answer.pick.plan.id}${person && !person.isSelf ? `?para=${person.id}` : ""}`} className={cn(buttonStyles.primary, "mt-3 w-full")}>
                  {answer.current ? `Trocar para o ${short(answer.pick.plan.name)}` : `Assinar o ${short(answer.pick.plan.name)}`}
                </Link>
              ) : null}
            </>
          ) : (
            <p>
              Com essa frequência, pagar cada visita sai melhor para {name} ({formatMoneyRound(answer.today)} por mês). Se passar a vir mais vezes, vale rever.
            </p>
          )}
        </Bubble>
      ) : null}
    </section>
  );
}

function Step({ question, hint, children }: { question: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <Bubble>
        <p>{question}</p>
        {hint ? <p className="text-xs text-muted">{hint}</p> : null}
      </Bubble>
      <div className="flex flex-wrap justify-end gap-2">{children}</div>
    </div>
  );
}

function Bubble({ children }: { children: React.ReactNode }) {
  return <div className="max-w-[560px] self-start rounded-2xl rounded-tl-sm bg-chip px-4 py-3 text-[15px] leading-relaxed">{children}</div>;
}

function Chip({ label, active, onClick, highlight }: { label: string; active: boolean; onClick: () => void; highlight?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn("min-h-10 rounded-full border-[1.5px] px-4 text-sm font-semibold", active ? "border-ink bg-ink text-white" : highlight ? "border-ink bg-white" : "border-line bg-white hover:border-ink")}
    >
      {label}
      {highlight && !active ? <span className="ml-1 text-[11px] font-normal text-muted">· seu</span> : null}
    </button>
  );
}
