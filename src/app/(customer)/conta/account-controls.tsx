"use client";

import { useState } from "react";
import Link from "next/link";
import { CreditCard, QrCode } from "lucide-react";
import { Eyebrow, cn } from "@/components/ui";

/**
 * Self-service for the subscription. In the MVP the choices are not sent anywhere yet:
 * they show the experience; the payment integration will apply them.
 */
export function AccountControls({ paused: initiallyPaused }: { paused: boolean }) {
  const [method, setMethod] = useState<"card" | "pix">("card");
  const [reminder, setReminder] = useState(true);
  const [paused, setPaused] = useState(initiallyPaused);
  const [askCancel, setAskCancel] = useState(false);

  return (
    <>
      <section className="flex flex-col gap-2.5">
        <Eyebrow>Forma de pagamento</Eyebrow>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["card", "Cartão", "final 4242", CreditCard],
              ["pix", "Pix Automático", "sem cartão vencido", QrCode],
            ] as const
          ).map(([id, label, sub, Icon]) => (
            <button
              key={id}
              type="button"
              aria-pressed={method === id}
              onClick={() => setMethod(id)}
              className={cn("flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-xl border-[1.5px] border-ink", method === id ? "bg-ink text-white" : "bg-white")}
            >
              <Icon size={18} aria-hidden="true" />
              <span className="text-sm font-semibold">{label}</span>
              <span className="text-[11px] opacity-80">{sub}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="flex items-center justify-between gap-3 rounded-2xl border border-line p-4">
        <span className="flex flex-col">
          <span className="font-semibold">Lembrete de corte</span>
          <span className="text-xs text-muted">Avisamos no WhatsApp quando chegar a hora de voltar</span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={reminder}
          aria-label="Lembrete de corte"
          onClick={() => setReminder((v) => !v)}
          className={cn("flex h-8 w-[52px] shrink-0 rounded-full p-[3px] transition", reminder ? "justify-end bg-ink" : "justify-start bg-[#cfcfcf]")}
        >
          <span className="size-[26px] rounded-full bg-white shadow" />
        </button>
      </div>

      <div className="flex flex-col overflow-hidden rounded-2xl border border-line">
        <Link href="/clube" className="flex min-h-[52px] items-center border-b border-line-soft px-4 text-[15px]">
          Trocar de plano
        </Link>
        <button type="button" onClick={() => setPaused((v) => !v)} className="flex min-h-[52px] items-center border-b border-line-soft px-4 text-left text-[15px]">
          {paused ? "Retomar assinatura" : "Pausar por 30 dias"}
        </button>
        <button type="button" onClick={() => setAskCancel((v) => !v)} className="flex min-h-[52px] items-center px-4 text-left text-[15px] text-muted">
          Cancelar assinatura
        </button>
      </div>
      {paused ? <p className="-mt-3 text-[13px] text-ink-soft">Assinatura pausada: sem cobrança nos próximos 30 dias.</p> : null}
      {askCancel ? (
        <p className="-mt-3 rounded-xl bg-chip p-4 text-sm text-ink-soft">
          Antes de cancelar, que tal pausar por 30 dias? Se preferir cancelar mesmo, a equipe finaliza com você pelo WhatsApp.
        </p>
      ) : null}
    </>
  );
}
