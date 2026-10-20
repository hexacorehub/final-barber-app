"use client";

import { useActionState } from "react";
import { buttonStyles } from "@/components/ui";
import { enterDemo } from "./actions";

export function DemoEnterForm({ initialError }: { initialError: boolean }) {
  const [state, action, pending] = useActionState(enterDemo, { error: initialError ? "Link de acesso inválido. Digite o código." : null });
  return (
    <form action={action} className="flex flex-col gap-3">
      <label htmlFor="codigo" className="text-sm font-semibold">
        Código de acesso
      </label>
      <input id="codigo" name="codigo" type="password" required autoComplete="off" className="h-12 rounded-xl border border-line px-4 text-base outline-none focus:border-ink" />
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
