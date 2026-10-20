"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, ChevronDown, Minus, Plus } from "lucide-react";
import { type UpgradeOption, comparePlans } from "@/domain/metrics";
import { formatMoney } from "@/domain/money";
import type { Plan } from "@/domain/types";
import { Badge, buttonStyles, cn } from "@/components/ui";

const TIERS: { id: Plan["tier"]; title: string; text: string }[] = [
  { id: "plus", title: "Plus", text: "O essencial para manter o visual em dia." },
  { id: "premium", title: "Premium", text: "A linha premium do Mister Club." },
];

const short = (name: string) => name.replace("Mister Club ", "");

export interface ClubPlansProps {
  plans: Plan[];
  haircutCents: number;
  beardCents: number;
  /** Plan of the person we are choosing for (the customer or someone in their account). */
  currentPlanId: string | null;
  targetName: string | null;
  upgrades: UpgradeOption[];
  /** Carried to the subscribe page: who the plan is for and the referral code. */
  query: string;
}

export function ClubPlans({ plans, haircutCents, beardCents, currentPlanId, targetName, upgrades, query }: ClubPlansProps) {
  const [haircuts, setHaircuts] = useState(2);
  const [beards, setBeards] = useState(2);
  const [open, setOpen] = useState<string | null>(null);
  const cmp = comparePlans(plans, haircutCents, beardCents, haircuts, beards);
  const best = cmp.rows.find((r) => r.plan.id === cmp.bestId);
  const current = plans.find((p) => p.id === currentPlanId);
  const href = (planId: string) => `/clube/assinar/${planId}${query ? `?${query}` : ""}`;

  return (
    <>
      {current && upgrades.length ? (
        <section className="flex flex-col gap-3 rounded-2xl border-2 border-ink p-5">
          <div>
            <h2 className="font-display text-lg font-semibold">{targetName ? `Mais para ${targetName}` : "Leve mais por pouco"}</h2>
            <p className="text-[13px] text-muted">
              {targetName ? `${targetName} está no` : "Você está no"} {short(current.name)} ({formatMoney(current.priceCents)}/mês). Veja quanto custa subir de plano.
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {upgrades.slice(0, 3).map((u) => {
              const extraValue = u.adds.includes("beard") ? beards * beardCents : u.adds.includes("haircut") ? haircuts * haircutCents : 0;
              const pays = extraValue - u.deltaCents;
              return (
                <Link key={u.plan.id} href={href(u.plan.id)} className="flex flex-col gap-2 rounded-xl bg-chip p-4 hover:bg-[#ebebeb]">
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{short(u.plan.name)}</span>
                    <ArrowUpRight size={16} aria-hidden="true" />
                  </span>
                  <span className="font-display text-xl tracking-normal">+{formatMoney(u.deltaCents)}/mês</span>
                  <span className="text-[13px] text-ink-soft">
                    {u.adds.length
                      ? `Inclui ${u.adds.map((a) => (a === "beard" ? "a barba" : "o corte")).join(" e ")}${pays > 0 ? `: com ${u.adds.includes("beard") ? beards : haircuts} por mês, sai ${formatMoney(pays)} mais barato que pagar à parte.` : "."}`
                      : "Mesma cobertura, na linha Premium. As vantagens extras são confirmadas pela equipe."}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      <div className="grid gap-6 md:grid-cols-[340px_minmax(0,1fr)] md:items-start">
        <section id="calculadora" className="scroll-mt-24 overflow-hidden rounded-2xl border border-line md:sticky md:top-24">
          <div className="flex flex-col gap-4 p-5">
            <h2 className="font-display text-[15px] tracking-[0.08em]">Quanto você gasta hoje?</h2>
            <Stepper label="Cortes por mês" value={haircuts} onChange={setHaircuts} />
            <Stepper label="Barbas por mês" value={beards} onChange={setBeards} />
            <div className="flex justify-between border-t border-line-soft pt-3.5 text-sm">
              <span className="text-muted">Pagando cada visita</span>
              <span className="font-semibold">{formatMoney(cmp.perVisitCents)}/mês</span>
            </div>
            {best ? (
              <div className="flex justify-between text-sm">
                <span className="text-muted">No {short(best.plan.name)}</span>
                <span className="font-semibold">{formatMoney(best.totalCents)}/mês</span>
              </div>
            ) : null}
          </div>
          {best ? (
            <div className="flex items-center justify-between bg-ink px-5 py-4 text-white">
              <span className="text-sm">Você economiza</span>
              <span className="font-display text-[26px] tracking-normal">
                {formatMoney(best.savingCents)}
                <span className="font-sans text-[13px] text-[#cfcfcf] normal-case"> /mês</span>
              </span>
            </div>
          ) : (
            <p className="bg-chip px-5 py-4 text-sm text-ink-soft">
              {cmp.perVisitCents ? "Com essa frequência, pagar cada visita ainda sai mais barato. O clube compensa quando você vem com mais frequência." : "Escolha quantos cortes ou barbas você faz por mês."}
            </p>
          )}
        </section>

        <section className="flex min-w-0 flex-col gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold">Compare os planos</h2>
            <p className="text-[13px] text-muted">
              Para {haircuts} {haircuts === 1 ? "corte" : "cortes"} e {beards} {beards === 1 ? "barba" : "barbas"} por mês. O que o plano não cobre entra como avulso.
            </p>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-line">
            <table className="w-full min-w-[600px] border-collapse text-sm">
              <thead>
                <tr className="text-left text-xs tracking-[0.06em] text-muted uppercase [&>th]:px-3 [&>th]:py-3 [&>th]:font-semibold">
                  <th className="pl-4">Plano</th>
                  <th className="text-center">Corte</th>
                  <th className="text-center">Barba</th>
                  <th className="text-right">Mensalidade</th>
                  <th className="text-right">Fora do plano</th>
                  <th className="text-right">Total/mês</th>
                  <th className="pr-4 text-right">Economia</th>
                </tr>
              </thead>
              <tbody>
                {cmp.rows.map((r) => {
                  const isBest = r.plan.id === cmp.bestId;
                  return (
                    <tr key={r.plan.id} className={cn("border-t border-line-soft [&>td]:px-3 [&>td]:py-3", isBest && "bg-ink text-white")}>
                      <td className="pl-4">
                        <span className="font-semibold">{short(r.plan.name)}</span>
                        <span className="mt-1 flex flex-wrap gap-1">
                          {isBest ? <Badge className="bg-white text-ink">Melhor para você</Badge> : null}
                          {r.plan.id === currentPlanId ? <Badge tone={isBest ? "neutral" : "dark"}>{targetName ? `Plano de ${targetName}` : "Seu plano"}</Badge> : null}
                          {r.plan.highlight === "best_seller" && !isBest ? <Badge>Mais vendido</Badge> : null}
                        </span>
                      </td>
                      <td className="text-center">{r.plan.covers.includes("haircut") ? <Check size={16} className="inline" aria-label="Incluso" /> : <span aria-label="Não incluso">—</span>}</td>
                      <td className="text-center">{r.plan.covers.includes("beard") ? <Check size={16} className="inline" aria-label="Incluso" /> : <span aria-label="Não incluso">—</span>}</td>
                      <td className="text-right whitespace-nowrap">{formatMoney(r.plan.priceCents)}</td>
                      <td className={cn("text-right whitespace-nowrap", !isBest && "text-muted")}>{r.extraCents ? `+${formatMoney(r.extraCents)}` : "—"}</td>
                      <td className="text-right font-semibold whitespace-nowrap">{formatMoney(r.totalCents)}</td>
                      <td className={cn("pr-4 text-right font-semibold whitespace-nowrap", !isBest && r.savingCents <= 0 && "font-normal text-muted")}>
                        {r.savingCents > 0 ? formatMoney(r.savingCents) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-muted">Pagando cada visita: {formatMoney(cmp.perVisitCents)}/mês. Valores avulsos de referência da barbearia.</p>
        </section>
      </div>

      {TIERS.map((tier) => (
        <section key={tier.id} className="flex flex-col gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold">{tier.title}</h2>
            <p className="text-[13px] text-muted">{tier.text}</p>
          </div>
          <div className="grid gap-3 md:grid-cols-3 md:gap-4">
            {plans
              .filter((p) => p.tier === tier.id)
              .sort((a, b) => a.sortOrder - b.sortOrder)
              .map((plan) => {
                const isBest = plan.id === cmp.bestId;
                const isOpen = open === plan.id;
                const isMine = plan.id === currentPlanId;
                const upgrade = upgrades.find((u) => u.plan.id === plan.id);
                return (
                  <article key={plan.id} className={cn("flex flex-col gap-3 rounded-2xl p-5", isBest ? "border-2 border-ink" : "border border-line")}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex flex-wrap gap-1.5">
                          {plan.highlight === "best_seller" ? <Badge tone="dark">Mais vendido</Badge> : null}
                          {isBest ? <Badge tone="ok">Recomendado pra você</Badge> : null}
                          {isMine ? <Badge>{targetName ? `Plano de ${targetName}` : "Seu plano"}</Badge> : null}
                          {upgrade ? <Badge>+{formatMoney(upgrade.deltaCents)} do atual</Badge> : null}
                        </div>
                        <h3 className="font-display text-lg leading-tight font-semibold">{plan.name}</h3>
                        <p className="text-xs text-muted">Tempo de vigência: indeterminado</p>
                      </div>
                      <div className="text-right whitespace-nowrap">
                        <p className="font-display text-[22px] tracking-normal">{formatMoney(plan.priceCents)}</p>
                        <p className="text-xs text-muted">por mês</p>
                      </div>
                    </div>
                    <ul className="flex flex-col gap-1.5">
                      {plan.covers.map((c) => (
                        <li key={c} className="flex items-center gap-2 text-sm text-ink-soft">
                          <Check size={16} strokeWidth={2.4} aria-hidden="true" />
                          {c === "haircut" ? "Corte incluso" : "Barba inclusa"}
                        </li>
                      ))}
                    </ul>
                    <button
                      type="button"
                      onClick={() => setOpen(isOpen ? null : plan.id)}
                      aria-expanded={isOpen}
                      className="flex items-center gap-1 self-start text-sm font-semibold underline-offset-2 hover:underline"
                    >
                      Confira as vantagens <ChevronDown size={16} className={cn("transition", isOpen && "rotate-180")} aria-hidden="true" />
                    </button>
                    {isOpen ? (
                      <div className="flex flex-col gap-2 rounded-xl bg-chip p-4 text-sm">
                        <ul className="flex flex-col gap-1.5">
                          {plan.benefits.map((b) => (
                            <li key={b} className="flex items-center gap-2">
                              <Check size={15} aria-hidden="true" /> {b}
                            </li>
                          ))}
                        </ul>
                        <p className="text-[13px] text-muted">O que está incluso e as condições são confirmados pela equipe no WhatsApp.</p>
                        <Link href="/clube/termos" className="text-[13px] font-semibold underline">
                          Termos de uso
                        </Link>
                      </div>
                    ) : null}
                    <div className="mt-auto">
                      {isMine ? (
                        <Link href="/conta" className={cn(buttonStyles.secondary, "w-full")}>
                          Gerenciar plano
                        </Link>
                      ) : (
                        <Link href={href(plan.id)} className={cn(isBest || upgrade ? buttonStyles.primary : buttonStyles.secondary, "w-full")}>
                          {upgrade ? "Trocar para este" : targetName ? `Assinar para ${targetName}` : "Assinar"}
                        </Link>
                      )}
                    </div>
                  </article>
                );
              })}
          </div>
        </section>
      ))}
    </>
  );
}

function Stepper({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm">{label}</span>
      <div className="flex items-center gap-1.5">
        <button type="button" aria-label={`Menos ${label.toLowerCase()}`} onClick={() => onChange(Math.max(0, value - 1))} className="flex size-11 items-center justify-center rounded-full border border-ink">
          <Minus size={18} aria-hidden="true" />
        </button>
        <span className="w-8 text-center font-display text-[22px]" aria-live="polite">
          {value}
        </span>
        <button type="button" aria-label={`Mais ${label.toLowerCase()}`} onClick={() => onChange(Math.min(8, value + 1))} className="flex size-11 items-center justify-center rounded-full bg-ink text-white">
          <Plus size={18} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
