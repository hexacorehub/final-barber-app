"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, Minus, Plus } from "lucide-react";
import { quotePlans } from "@/domain/metrics";
import { formatMoney } from "@/domain/money";
import type { Plan } from "@/domain/types";
import { Badge, buttonStyles, cn } from "@/components/ui";

const TIERS: { id: Plan["tier"]; title: string; text: string }[] = [
  { id: "plus", title: "Plus", text: "O essencial para manter o visual em dia." },
  { id: "premium", title: "Premium", text: "A linha premium do Mister Club." },
];

export function ClubPlans({ plans, haircutCents, beardCents, currentPlanId }: { plans: Plan[]; haircutCents: number; beardCents: number; currentPlanId: string | null }) {
  const [haircuts, setHaircuts] = useState(2);
  const [beards, setBeards] = useState(2);
  const [open, setOpen] = useState<string | null>(null);
  const quote = quotePlans(plans, haircutCents, beardCents, haircuts, beards);
  const recommended = quote.best && quote.best.savingCents > 0 ? quote.best.plan.id : null;

  return (
    <>
      <section id="calculadora" className="scroll-mt-20 overflow-hidden rounded-2xl border border-line">
        <div className="flex flex-col gap-4 p-5">
          <h2 className="font-display text-[15px] tracking-[0.08em]">Quanto você gasta hoje?</h2>
          <Stepper label="Cortes por mês" value={haircuts} onChange={setHaircuts} />
          <Stepper label="Barbas por mês" value={beards} onChange={setBeards} />
          <div className="flex justify-between border-t border-line-soft pt-3.5 text-sm">
            <span className="text-muted">Pagando cada visita</span>
            <span className="font-semibold">{formatMoney(quote.perVisitCents)}/mês</span>
          </div>
          {quote.best ? (
            <div className="flex justify-between text-sm">
              <span className="text-muted">No {quote.best.plan.name.replace("Mister Club ", "")}</span>
              <span className="font-semibold">{formatMoney(quote.best.plan.priceCents)}/mês</span>
            </div>
          ) : null}
        </div>
        {quote.best && quote.best.savingCents > 0 ? (
          <div className="flex items-center justify-between bg-ink px-5 py-4 text-white">
            <span className="text-sm">Você economiza</span>
            <span className="font-display text-[26px] tracking-normal">
              {formatMoney(quote.best.savingCents)}
              <span className="font-sans text-[13px] text-[#cfcfcf] normal-case"> /mês</span>
            </span>
          </div>
        ) : (
          <p className="bg-chip px-5 py-4 text-sm text-ink-soft">
            {quote.best ? "Com essa frequência, pagar cada visita ainda sai mais barato. O clube compensa quando você vem com mais frequência." : "Escolha quantos cortes ou barbas você faz por mês."}
          </p>
        )}
      </section>

      {TIERS.map((tier) => (
        <section key={tier.id} className="flex flex-col gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold">{tier.title}</h2>
            <p className="text-[13px] text-muted">{tier.text}</p>
          </div>
          {plans
            .filter((p) => p.tier === tier.id)
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((plan) => {
              const isRec = plan.id === recommended;
              const isOpen = open === plan.id;
              const isMine = plan.id === currentPlanId;
              return (
                <article key={plan.id} className={cn("flex flex-col gap-3 rounded-2xl p-5", isRec ? "border-2 border-ink" : "border border-line")}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex flex-wrap gap-1.5">
                        {plan.highlight === "best_seller" ? <Badge tone="dark">Mais vendido</Badge> : null}
                        {isRec ? <Badge tone="ok">Recomendado pra você</Badge> : null}
                        {isMine ? <Badge>Seu plano</Badge> : null}
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
                  <button type="button" onClick={() => setOpen(isOpen ? null : plan.id)} aria-expanded={isOpen} className="flex items-center gap-1 self-start text-sm font-semibold underline-offset-2 hover:underline">
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
                  {isMine ? (
                    <Link href="/conta" className={buttonStyles.secondary}>
                      Gerenciar meu plano
                    </Link>
                  ) : (
                    <Link href={`/clube/assinar/${plan.id}`} className={isRec ? buttonStyles.primary : buttonStyles.secondary}>
                      Assinar
                    </Link>
                  )}
                </article>
              );
            })}
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
