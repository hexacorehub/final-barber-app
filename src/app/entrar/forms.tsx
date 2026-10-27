"use client";

import { useActionState } from "react";
import { buttonStyles, cn } from "@/components/ui";
import { signIn, signUp } from "./actions";

const input = "min-h-12 rounded-xl border border-line px-4 font-normal";

export function SignInForm() {
  const [state, action, pending] = useActionState(signIn, { error: null });
  return (
    <form action={action} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm font-semibold">
        CPF ou e-mail
        <input name="identifier" required autoComplete="username" inputMode="email" className={input} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Senha
        <input name="password" type="password" required autoComplete="current-password" className={input} />
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

export function SignUpForm() {
  const [state, action, pending] = useActionState(signUp, { error: null, field: null });
  const field = (name: string, label: string, props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <label className="flex flex-col gap-1 text-sm font-semibold">
      {label}
      <input name={name} required aria-invalid={state.field === name} className={cn(input, state.field === name && "border-bad")} {...props} />
      {state.field === name && state.error ? <span className="text-xs font-semibold text-bad">{state.error}</span> : null}
    </label>
  );
  return (
    <form action={action} className="flex flex-col gap-3">
      {field("name", "Nome completo", { autoComplete: "name" })}
      {field("cpf", "CPF", { inputMode: "numeric", placeholder: "000.000.000-00", autoComplete: "off" })}
      {field("email", "E-mail", { type: "email", autoComplete: "email" })}
      {field("phone", "WhatsApp", { type: "tel", placeholder: "(11) 90000-0000", autoComplete: "tel" })}
      {field("password", "Senha (8 caracteres ou mais)", { type: "password", autoComplete: "new-password", minLength: 8 })}
      <p className="text-xs text-muted">Um CPF por conta. Você entra depois com o CPF ou o e-mail. Filhos e outras pessoas da família você adiciona dentro da sua conta.</p>
      <button type="submit" disabled={pending} className={buttonStyles.primary}>
        {pending ? "Criando conta…" : "Criar conta"}
      </button>
    </form>
  );
}
