"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { UserPlus } from "lucide-react";
import { RELATIONSHIP_LABEL, RELATIONSHIPS } from "@/domain/household";
import { buttonStyles, cn } from "@/components/ui";
import { addMember, type AddMemberState } from "./actions";

export function AddMemberForm() {
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState<AddMemberState, FormData>(addMember, { error: null, added: null });
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.added) {
      form.current?.reset();
      setOpen(false);
    }
  }, [state]);

  return (
    <div className="flex flex-col gap-2">
      {state.added && !open ? <p className="rounded-xl bg-ok-bg p-3 text-sm text-ok">{state.added} foi adicionado(a) à sua conta. Agora você pode agendar e contratar um plano para essa pessoa.</p> : null}
      {open ? (
        <form ref={form} action={action} className="flex flex-col gap-3 rounded-2xl border border-line p-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="m-name" className="text-sm font-semibold">
              Nome
            </label>
            <input id="m-name" name="name" required minLength={2} className="h-12 rounded-xl border border-line px-4 text-base outline-none focus:border-ink" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="m-rel" className="text-sm font-semibold">
              Parentesco
            </label>
            <select id="m-rel" name="relationship" required className="h-12 rounded-xl border border-line bg-white px-3 text-base outline-none focus:border-ink">
              {RELATIONSHIPS.map((r) => (
                <option key={r} value={r}>
                  {RELATIONSHIP_LABEL[r]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="m-phone" className="text-sm font-semibold">
              WhatsApp <span className="font-normal text-muted">(opcional, para lembretes dessa pessoa)</span>
            </label>
            <input id="m-phone" name="phone" inputMode="tel" className="h-12 rounded-xl border border-line px-4 text-base outline-none focus:border-ink" />
          </div>
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input type="checkbox" name="minor" className="size-5 accent-ink" /> Menor de idade
          </label>
          <p className="text-xs text-muted">Você fica como responsável: só você agenda, contrata e paga os planos dessa pessoa.</p>
          {state.error ? (
            <p role="alert" className="text-sm font-semibold text-bad">
              {state.error}
            </p>
          ) : null}
          <div className="flex gap-2">
            <button type="button" onClick={() => setOpen(false)} className={cn(buttonStyles.secondary, "flex-1")}>
              Cancelar
            </button>
            <button type="submit" disabled={pending} className={cn(buttonStyles.primary, "flex-1")}>
              {pending ? "Adicionando…" : "Adicionar"}
            </button>
          </div>
        </form>
      ) : (
        <button type="button" onClick={() => setOpen(true)} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border-[1.5px] border-dashed border-[#9a9a9a] text-sm text-ink-soft">
          <UserPlus size={16} aria-hidden="true" /> Adicionar pessoa (filho, sogro, parceiro…)
        </button>
      )}
    </div>
  );
}
