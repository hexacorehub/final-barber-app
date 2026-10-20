"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, CreditCard, QrCode } from "lucide-react";
import { formatMoney } from "@/domain/money";
import type { Plan } from "@/domain/types";
import { buttonStyles, cn } from "@/components/ui";
import { requestPlan } from "../actions";

const METHODS = [
  { id: "card", label: "Cartão de crédito", sub: "Cobrança automática todo mês", Icon: CreditCard },
  { id: "pix", label: "Pix Automático", sub: "Sem cartão vencido ou recusado", Icon: QrCode },
] as const;

export function SubscribeForm({ plan }: { plan: Plan }) {
  const [method, setMethod] = useState<(typeof METHODS)[number]["id"]>("pix");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (done) {
    return (
      <div className="flex flex-col items-center gap-4 pt-8 text-center">
        <span className="flex size-[72px] items-center justify-center rounded-full bg-ink text-white">
          <Check size={34} strokeWidth={2.4} aria-hidden="true" />
        </span>
        <h1 className="font-display text-[28px] font-semibold">Pedido recebido</h1>
        <p className="text-[15px] text-ink-soft">
          A equipe confirma o <strong>{plan.name}</strong> com você pelo WhatsApp e ativa a cobrança por {method === "pix" ? "Pix Automático" : "cartão"}.
        </p>
        <Link href="/inicio" className={cn(buttonStyles.primary, "w-full")}>
          Voltar ao início
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl bg-ink p-5 text-white">
        <p className="text-[13px] text-[#cfcfcf]">Você está assinando</p>
        <h1 className="font-display text-[22px] leading-tight font-semibold">{plan.name}</h1>
        <p className="mt-3 font-display text-[30px] tracking-normal">
          {formatMoney(plan.priceCents)}
          <span className="font-sans text-sm text-[#cfcfcf] normal-case"> por mês</span>
        </p>
        <ul className="mt-3 flex flex-col gap-1.5 text-sm text-[#e8e8e8]">
          {plan.benefits.map((b) => (
            <li key={b} className="flex items-center gap-2">
              <Check size={15} aria-hidden="true" /> {b}
            </li>
          ))}
        </ul>
      </div>

      <fieldset className="flex flex-col gap-2.5">
        <legend className="mb-2.5 text-xs font-semibold tracking-[0.08em] text-muted uppercase">Forma de pagamento</legend>
        {METHODS.map(({ id, label, sub, Icon }) => (
          <label key={id} className={cn("flex min-h-16 cursor-pointer items-center gap-3 rounded-2xl border-[1.5px] px-4", method === id ? "border-ink" : "border-line")}>
            <input type="radio" name="method" value={id} checked={method === id} onChange={() => setMethod(id)} className="size-4 accent-ink" />
            <Icon size={20} aria-hidden="true" />
            <span className="flex flex-col">
              <span className="text-[15px] font-semibold">{label}</span>
              <span className="text-xs text-muted">{sub}</span>
            </span>
          </label>
        ))}
      </fieldset>

      <p className="text-[13px] text-muted">
        O pagamento cai direto na conta da barbearia. Ao continuar, você concorda com os{" "}
        <Link href="/clube/termos" className="font-semibold text-ink underline">
          termos de uso
        </Link>
        .
      </p>
      {error ? (
        <p role="alert" className="text-sm font-semibold text-bad">
          {error}
        </p>
      ) : null}
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await requestPlan(plan.id);
            if (res.ok) setDone(true);
            else setError(res.error ?? "Não foi possível enviar o pedido.");
          })
        }
        className={buttonStyles.primary}
      >
        {pending ? "Enviando…" : "Quero assinar"}
      </button>
    </div>
  );
}
