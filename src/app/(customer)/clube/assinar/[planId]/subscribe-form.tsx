"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, CreditCard, Gift, QrCode, UserPlus } from "lucide-react";
import { formatMoney } from "@/domain/money";
import type { Plan } from "@/domain/types";
import { Eyebrow, buttonStyles, cn } from "@/components/ui";
import { requestPlan } from "../actions";

const METHODS = [
  { id: "card", label: "Cartão de crédito", sub: "Cobrança automática todo mês", Icon: CreditCard },
  { id: "pix", label: "Pix Automático", sub: "Sem cartão vencido ou recusado", Icon: QrCode },
] as const;

interface Member {
  id: string;
  name: string;
  label: string;
  currentPlanId: string | null;
  currentPlanName: string | null;
}

export function SubscribeForm(props: { plan: Plan; isHolder: boolean; initialFor: string; members: Member[]; referral: { code: string; name: string } | null }) {
  const { plan, members, referral } = props;
  const [forId, setForId] = useState(props.initialFor);
  const [method, setMethod] = useState<(typeof METHODS)[number]["id"]>("pix");
  const [done, setDone] = useState<"new" | "upgrade" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const target = members.find((m) => m.id === forId)!;
  const isSelf = forId === members[0]?.id;

  if (!props.isHolder) {
    return (
      <div className="flex flex-col gap-3 rounded-2xl bg-chip p-5 text-sm text-ink-soft">
        <p className="font-semibold text-ink">Só o titular da conta contrata planos.</p>
        <p>Peça para quem gerencia a sua conta assinar por você. A cobrança fica com o titular.</p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-4 pt-8 text-center">
        <span className="flex size-[72px] items-center justify-center rounded-full bg-ink text-white">
          <Check size={34} strokeWidth={2.4} aria-hidden="true" />
        </span>
        <h1 className="font-display text-[28px] font-semibold">Pedido recebido</h1>
        <p className="text-[15px] text-ink-soft">
          A equipe confirma {done === "upgrade" ? "a troca para o" : "o"} <strong>{plan.name}</strong> {isSelf ? "com você" : `de ${target.name.split(" ")[0]}`} pelo WhatsApp e ativa a cobrança
          por {method === "pix" ? "Pix Automático" : "cartão"}.
        </p>
        {referral && done === "new" ? <p className="text-sm text-ok">{referral.name} ganha 50% na próxima mensalidade quando o plano for ativado.</p> : null}
        <Link href="/inicio" className={cn(buttonStyles.primary, "w-full")}>
          Voltar ao início
        </Link>
      </div>
    );
  }

  const samePlan = target.currentPlanId === plan.id;

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl bg-ink p-5 text-white">
        <p className="text-[13px] text-[#cfcfcf]">{target.currentPlanId ? "Trocar para" : "Você está assinando"}</p>
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

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2.5">
          <Eyebrow>Para quem é o plano?</Eyebrow>
        </legend>
        {members.map((m) => (
          <label key={m.id} className={cn("flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border-[1.5px] px-4 py-2", forId === m.id ? "border-ink" : "border-line")}>
            <input type="radio" name="for" value={m.id} checked={forId === m.id} onChange={() => setForId(m.id)} className="size-4 accent-ink" />
            <span className="flex flex-1 flex-col">
              <span className="text-[15px] font-semibold">{m.name}</span>
              <span className="text-xs text-muted">{m.label}</span>
            </span>
            <span className="text-right text-xs text-muted">{m.currentPlanName ? `Hoje: ${m.currentPlanName}` : "Sem plano"}</span>
          </label>
        ))}
        <Link href="/conta#familia" className="flex min-h-11 items-center gap-2 self-start text-sm font-semibold">
          <UserPlus size={16} aria-hidden="true" /> Adicionar alguém à conta
        </Link>
        <p className="text-xs text-muted">Cada pessoa tem um plano. Você, como titular, autoriza e paga os planos de quem está na sua conta.</p>
      </fieldset>

      <fieldset className="flex flex-col gap-2.5">
        <legend className="mb-2.5">
          <Eyebrow>Forma de pagamento</Eyebrow>
        </legend>
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

      {referral && !target.currentPlanId ? (
        <p className="flex items-center gap-2 rounded-xl bg-ok-bg p-3 text-sm text-ok">
          <Gift size={16} aria-hidden="true" /> Convite de {referral.name} ({referral.code}) aplicado.
        </p>
      ) : null}

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
        disabled={pending || samePlan}
        onClick={() =>
          start(async () => {
            setError(null);
            const res = await requestPlan(plan.id, forId, referral?.code ?? null);
            if (res.ok) setDone(res.kind);
            else setError(res.error);
          })
        }
        className={buttonStyles.primary}
      >
        {samePlan ? `${isSelf ? "Você já tem" : `${target.name.split(" ")[0]} já tem`} esse plano` : pending ? "Enviando…" : target.currentPlanId ? "Pedir a troca de plano" : isSelf ? "Quero assinar" : `Assinar para ${target.name.split(" ")[0]}`}
      </button>
    </div>
  );
}
