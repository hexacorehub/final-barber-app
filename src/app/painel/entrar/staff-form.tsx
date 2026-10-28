"use client";

import { useActionState } from "react";
import { buttonStyles } from "@/components/ui";
import { enterAsStaff } from "./actions";

export function StaffForm() {
  const [state, action, pending] = useActionState(enterAsStaff, { error: null });
  return (
    <form action={action} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm font-semibold">
        E-mail
        <input name="email" type="email" autoComplete="username" required className="min-h-12 rounded-xl border border-line px-4 font-normal" />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Senha
        <input name="password" type="password" autoComplete="current-password" required className="min-h-12 rounded-xl border border-line px-4 font-normal" />
      </label>
      {state.error ? (
        <p role="alert" className="text-sm font-semibold text-bad">
          {state.error}
        </p>
      ) : null}
      <button type="submit" disabled={pending} className={buttonStyles.primary}>
        {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
