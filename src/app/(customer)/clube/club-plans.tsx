"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, Minus, Plus, X } from "lucide-react";
import { type PlanAdvice, type Prices, type UsageProfile, perVisitCost, planAdvice, recommendedPlan } from "@/domain/plan-advice";
import { formatMoney, formatMoneyRound } from "@/domain/money";
import type { Plan } from "@/domain/types";
import { Badge, buttonStyles, cn } from "@/components/ui";

const short = (name: string) => name.replace("Mister Club ", "");

export interface ClubPlansProps {
  plans: Plan[];
  prices: Prices;
  /** Visits a month estimated from the person's history. */
  history: UsageProfile;
  /** Plan of the person we are choosing for (the customer or someone in their account). */
  currentPlanId: string | null;
  /** First name when choosing for someone else in the account. */
  targetName: string | null;
  /** Carried to the subscribe page: who the plan is for and the referral code. */
  query: string;
}

const KIND_TONE: Record<PlanAdvice["kind"], string> = {
  saves: "text-ok",
  current: "text-ink-soft",
  close: "text-ink-soft",
  costs_more: "text-ink-soft",
  not_for_you: "text-muted",
  needs_usage: "text-muted",
};

export function ClubPlans({ plans, prices, history, currentPlanId, targetName, query }: ClubPlansProps) {
  const initial = history.enough ? { haircuts: history.haircuts, beards: history.beards } : { haircuts: 0, beards: 0 };
  const [haircuts, setHaircuts] = useState(initial.haircuts);
  const [beards, setBeards] = useState(initial.beards);
  const [touched, setTouched] = useState(false);
  const usage = useMemo(() => ({ haircuts, beards }), [haircuts, beards]);
  const known = history.enough || touched;
  const current = plans.find((p) => p.id === currentPlanId) ?? null;

  const rows = useMemo(() => {
    const list = [...plans].sort((a, b) => a.sortOrder - b.sortOrder).map((plan) => ({ plan, advice: planAdvice(plan, usage, prices, { currentPlan: current, known }) }));
    return { list, recommended: recommendedPlan(list) };
  }, [plans, usage, prices, current, known]);

  // Phones: the most relevant first (recommended, then the current plan), then the shop's order.
  const cardOrder = [...rows.list].sort((a, b) => rank(a.plan.id) - rank(b.plan.id));
  function rank(id: string) {
    return id === rows.recommended ? 0 : id === currentPlanId ? 1 : 2;
  }

  const set = (fn: (v: number) => void) => (v: number) => {
    fn(v);
    setTouched(true);
  };
  const who = targetName ?? "você";
  const today = current ? current.priceCents : perVisitCost(usage, prices);
  const href = (planId: string) => `/clube/assinar/${planId}${query ? `?${query}` : ""}`;

  return (
    <>
      <section id="calculadora" aria-labelledby="h-usage" className="scroll-mt-24 rounded-2xl border border-line p-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-8">
          <div className="flex flex-col gap-1">
            <h2 id="h-usage" className="font-display text-[15px] tracking-[0.08em]">
              {targetName ? `Uso de ${targetName} hoje` : "Seu uso hoje"}
            </h2>
            <p className="text-[13px] text-muted">
              {history.enough && !touched
                ? `Pelo histórico dos últimos ${Math.round(history.windowDays / 30)} meses: cerca de ${history.haircuts} ${history.haircuts === 1 ? "corte" : "cortes"} e ${history.beards} ${history.beards === 1 ? "barba" : "barbas"} por mês.`
                : history.enough
                  ? "Valores ajustados por você."
                  : `Ainda não há histórico suficiente. Conte quantas vezes ${who === "você" ? "você vem" : `${who} vem`} por mês para comparar.`}
              {history.enough && touched ? (
                <button
                  type="button"
                  onClick={() => {
                    setHaircuts(history.haircuts);
                    setBeards(history.beards);
                    setTouched(false);
                  }}
                  className="ml-1 font-semibold text-ink underline"
                >
                  Voltar ao histórico
                </button>
              ) : null}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 md:flex md:gap-6">
            <Stepper label="Cortes por mês" value={haircuts} onChange={set(setHaircuts)} />
            <Stepper label="Barbas por mês" value={beards} onChange={set(setBeards)} />
          </div>
        </div>
        {known && (haircuts || beards) ? (
          <p className="mt-4 border-t border-line-soft pt-3.5 text-sm">
            Hoje: <strong>{formatMoney(today)}/mês</strong>{" "}
            <span className="text-muted">{current ? `(${short(current.name)})` : `(pagando cada visita: ${haircuts ? `${haircuts} × ${formatMoney(prices.haircutCents)}` : ""}${haircuts && beards ? " + " : ""}${beards ? `${beards} × ${formatMoney(prices.beardCents)}` : ""})`}</span>
          </p>
        ) : null}
      </section>

      <section aria-labelledby="h-plans" className="flex flex-col gap-3">
        <div>
          <h2 id="h-plans" className="font-display text-lg font-semibold">
            Compare os planos
          </h2>
          <p className="text-[13px] text-muted">O que o plano não cobre entra como avulso no total. Valores avulsos de referência da barbearia.</p>
        </div>

        {/* Phones: one plan per card, compared top to bottom */}
        <ul className="flex flex-col gap-3 md:hidden">
          {cardOrder.map(({ plan, advice }) => (
            <li key={plan.id}>
              <PlanCard
                plan={plan}
                advice={advice}
                known={known}
                recommended={plan.id === rows.recommended}
                mine={plan.id === currentPlanId}
                switching={Boolean(current) && plan.id !== currentPlanId}
                targetName={targetName}
                href={href(plan.id)}
              />
            </li>
          ))}
        </ul>

        {/* Tablet and desktop: a single table */}
        <div className="hidden overflow-hidden rounded-2xl border border-line md:block">
          <table className="w-full border-collapse text-sm">
            <caption className="sr-only">Comparação dos planos do Mister Club para o seu uso</caption>
            <thead>
              <tr className="text-left text-xs tracking-[0.06em] text-muted uppercase [&>th]:px-3 [&>th]:py-3 [&>th]:font-semibold">
                <th className="pl-5">Plano</th>
                <th>Cobre</th>
                <th className="text-right">Mensalidade</th>
                <th className="text-right">Para {who}/mês</th>
                <th className="w-[34%]">Comparado a hoje</th>
                <th className="pr-5">
                  <span className="sr-only">Ação</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.list.map(({ plan, advice }) => {
                const rec = plan.id === rows.recommended;
                const mine = plan.id === currentPlanId;
                return (
                  <tr key={plan.id} className={cn("border-t border-line-soft align-top [&>td]:px-3 [&>td]:py-3.5", rec && "bg-ok-bg/60", advice.kind === "not_for_you" && "text-muted")}>
                    <td className="pl-5">
                      <span className="font-semibold text-ink">{short(plan.name)}</span>
                      <span className="mt-1 flex flex-wrap gap-1">
                        {rec ? <Badge tone="ok">Mais vantajoso para {who}</Badge> : null}
                        {mine ? <Badge tone="dark">{targetName ? `Plano de ${targetName}` : "Seu plano"}</Badge> : null}
                        {plan.highlight === "best_seller" ? <Badge>Mais vendido</Badge> : null}
                      </span>
                    </td>
                    <td>
                      <Covers plan={plan} />
                    </td>
                    <td className="text-right whitespace-nowrap">{formatMoney(plan.priceCents)}</td>
                    <td className="text-right font-semibold whitespace-nowrap">{known ? formatMoney(advice.totalCents) : "—"}</td>
                    <td>
                      <Difference advice={advice} known={known} />
                      <p className={cn("mt-1 text-[13px] leading-snug", KIND_TONE[advice.kind])}>{advice.message}</p>
                    </td>
                    <td className="pr-5 text-right">
                      <PlanAction plan={plan} mine={mine} rec={rec} upgrade={Boolean(current) && !mine} targetName={targetName} href={href(plan.id)} compact />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="text-xs leading-relaxed text-muted">
          Todos os planos: vigência por tempo indeterminado e cobrança mensal automática. Quantos atendimentos por mês cada plano inclui e as demais condições são
          confirmados pela equipe no WhatsApp antes da ativação.{" "}
          <Link href="/clube/termos" className="font-semibold text-ink underline">
            Termos de uso
          </Link>
        </p>
      </section>
    </>
  );
}

function PlanCard(props: { plan: Plan; advice: PlanAdvice; known: boolean; recommended: boolean; mine: boolean; switching: boolean; targetName: string | null; href: string }) {
  const { plan, advice, known } = props;
  return (
    <article className={cn("flex flex-col gap-3 rounded-2xl p-4", props.recommended ? "border-2 border-ok" : props.mine ? "border-2 border-ink" : "border border-line")}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex flex-wrap gap-1">
            {props.recommended ? <Badge tone="ok">Mais vantajoso para {props.targetName ?? "você"}</Badge> : null}
            {props.mine ? <Badge tone="dark">{props.targetName ? `Plano de ${props.targetName}` : "Seu plano"}</Badge> : null}
            {plan.highlight === "best_seller" ? <Badge>Mais vendido</Badge> : null}
          </div>
          <h3 className="font-display text-lg leading-tight font-semibold">{short(plan.name)}</h3>
          <Covers plan={plan} />
        </div>
        <p className="shrink-0 text-right">
          <span className="block font-display text-[22px] leading-none tracking-normal">{formatMoney(plan.priceCents)}</span>
          <span className="text-xs text-muted">por mês</span>
        </p>
      </div>
      {known ? (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-chip px-3 py-2.5 text-sm">
          <span>
            Para {props.targetName ?? "você"}: <strong>{formatMoney(advice.totalCents)}/mês</strong>
          </span>
          <Difference advice={advice} known={known} />
        </div>
      ) : null}
      <p className={cn("text-[13px] leading-snug", KIND_TONE[advice.kind])}>{advice.message}</p>
      <PlanAction plan={plan} mine={props.mine} rec={props.recommended} upgrade={props.switching} targetName={props.targetName} href={props.href} />
    </article>
  );
}

function Covers({ plan }: { plan: Plan }) {
  return (
    <span className="flex gap-3 text-[13px]">
      {(["haircut", "beard"] as const).map((c) => {
        const on = plan.covers.includes(c);
        return (
          <span key={c} className={cn("flex items-center gap-1", on ? "text-ink" : "text-muted line-through decoration-1")}>
            {on ? <Check size={14} strokeWidth={2.6} aria-hidden="true" /> : <X size={14} aria-hidden="true" />}
            {c === "haircut" ? "Corte" : "Barba"}
            <span className="sr-only">{on ? "incluso" : "não incluso"}</span>
          </span>
        );
      })}
    </span>
  );
}

function Difference({ advice, known }: { advice: PlanAdvice; known: boolean }) {
  if (!known || advice.kind === "needs_usage" || advice.kind === "current" || advice.kind === "not_for_you") return null;
  const d = advice.differenceCents;
  if (advice.kind === "close") return <span className="text-[13px] font-semibold whitespace-nowrap text-ink-soft">≈ o mesmo</span>;
  return (
    <span className={cn("text-[13px] font-semibold whitespace-nowrap", d > 0 ? "text-ok" : "text-ink-soft")}>
      {d > 0 ? `${formatMoneyRound(d)} a menos` : `${formatMoneyRound(-d)} a mais`}
    </span>
  );
}

function PlanAction(props: { plan: Plan; mine: boolean; rec: boolean; upgrade: boolean; targetName: string | null; href: string; compact?: boolean }) {
  if (props.mine) {
    return (
      <Link href="/conta" className={cn(buttonStyles.secondary, props.compact ? "min-h-10 px-3 text-[13px] whitespace-nowrap" : "w-full")}>
        Gerenciar
      </Link>
    );
  }
  const label = props.upgrade ? "Trocar para este plano" : props.targetName ? `Assinar para ${props.targetName}` : "Assinar";
  return (
    <Link href={props.href} className={cn(props.rec ? buttonStyles.primary : buttonStyles.secondary, props.compact ? "min-h-10 px-3 text-[13px] whitespace-nowrap" : "w-full")}>
      {props.compact ? (props.upgrade ? "Trocar" : "Assinar") : label}
    </Link>
  );
}

function Stepper({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm">{label}</span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          aria-label={`Menos ${label.toLowerCase()}`}
          onClick={() => onChange(Math.max(0, value - 1))}
          disabled={value === 0}
          className="flex size-11 items-center justify-center rounded-full border border-ink disabled:border-line disabled:text-faint"
        >
          <Minus size={18} aria-hidden="true" />
        </button>
        <span className="w-8 text-center font-display text-[22px]" aria-live="polite" aria-label={`${value} ${label.toLowerCase()}`}>
          {value}
        </span>
        <button
          type="button"
          aria-label={`Mais ${label.toLowerCase()}`}
          onClick={() => onChange(Math.min(8, value + 1))}
          disabled={value === 8}
          className="flex size-11 items-center justify-center rounded-full bg-ink text-white disabled:bg-track"
        >
          <Plus size={18} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
