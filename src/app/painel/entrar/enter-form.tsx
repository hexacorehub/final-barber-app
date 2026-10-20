"use client";

import { useActionState } from "react";
import { buttonStyles } from "@/components/ui";
import { enterDashboard } from "./actions";

export function EnterForm() {
  const [state, action, pending] = useActionState(enterDashboard, { error: null });
  return (
    <form action={action} className="flex flex-col gap-3">
      <label htmlFor="passcode" className="text-sm font-semibold">
        Código de acesso
      </label>
      <input id="passcode" name="passcode" type="password" required autoComplete="current-password" className="h-12 rounded-xl border border-line px-4 text-base outline-none focus:border-ink" />
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
