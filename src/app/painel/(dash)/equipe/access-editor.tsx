"use client";

import { useActionState, useState, useTransition } from "react";
import type { Grant, Permission } from "@/domain/access";
import { buttonStyles, cn } from "@/components/ui";
import { addMember, setActive, setPermission } from "./actions";

const OPTIONS: { value: string; label: string }[] = [
  { value: "none", label: "Não" },
  { value: "own", label: "Só o dele" },
  { value: "units", label: "Unidades dela" },
  { value: "all", label: "Todas" },
];

export function GrantSelect({ staffId, permission, value, isDefault, defaultGrant, scoped, locked }: { staffId: string; permission: Permission; value: Grant; isDefault: boolean; defaultGrant: Grant; scoped: boolean; locked: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const current = value === false ? "none" : value;
  const options = scoped ? OPTIONS : OPTIONS.filter((o) => o.value === "none" || o.value === "all");
  return (
    <div className="flex flex-col items-end gap-0.5">
      <select
        aria-label="Acesso"
        value={current}
        disabled={pending || locked}
        onChange={(e) =>
          start(async () => {
            const v = e.target.value;
            const def = defaultGrant === false ? "none" : defaultGrant;
            const res = await setPermission(staffId, permission, v === def ? "default" : v);
            setError(res.error);
          })
        }
        className={cn("min-h-9 rounded-lg border px-2 text-[13px]", isDefault ? "border-line" : "border-ink font-semibold", locked && "bg-chip text-muted")}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error ? <span className="text-[11px] text-bad">{error}</span> : null}
    </div>
  );
}

export function ActiveToggle({ staffId, active }: { staffId: string; active: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} onClick={() => start(async () => void (await setActive(staffId, !active)))} className="min-h-9 rounded-lg border border-line px-3 text-[13px] font-semibold hover:border-ink">
      {active ? "Desligar acesso" : "Reativar"}
    </button>
  );
}

export function AddMemberForm({ units, barbers }: { units: { id: string; name: string }[]; barbers: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(addMember, { error: null, created: null });
  const [role, setRole] = useState("reception");
  return (
    <form action={action} className="grid gap-3 px-5 py-4 md:grid-cols-2">
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Nome
        <input name="name" required className="min-h-11 rounded-xl border border-line px-3 font-normal" />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        E-mail
        <input name="email" type="email" required className="min-h-11 rounded-xl border border-line px-3 font-normal" />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Função
        <select name="role" value={role} onChange={(e) => setRole(e.target.value)} className="min-h-11 rounded-xl border border-line px-3 font-normal">
          <option value="reception">Recepção</option>
          <option value="barber">Barbeiro</option>
          <option value="manager">Gerente da unidade</option>
        </select>
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Unidade
        <select name="unitId" className="min-h-11 rounded-xl border border-line px-3 font-normal">
          {units.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </label>
      {role === "barber" ? (
        <label className="flex flex-col gap-1 text-sm font-semibold md:col-span-2">
          Qual barbeiro é
          <select name="barberId" className="min-h-11 rounded-xl border border-line px-3 font-normal">
            {barbers.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <div className="flex flex-wrap items-center gap-3 md:col-span-2">
        <button type="submit" disabled={pending} className={buttonStyles.primary}>
          {pending ? "Criando…" : "Adicionar pessoa"}
        </button>
        {state.error ? <p className="text-sm font-semibold text-bad">{state.error}</p> : null}
        {state.created ? <p className="text-sm font-semibold text-ok">{state.created}</p> : null}
      </div>
    </form>
  );
}
