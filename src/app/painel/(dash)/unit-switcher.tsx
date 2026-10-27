"use client";

import { useTransition } from "react";
import { MapPin } from "lucide-react";
import { choosePainelUnit } from "./unit-actions";

export function UnitSwitcher({ units, current }: { units: { id: string; name: string }[]; current: string | null }) {
  const [pending, start] = useTransition();
  if (units.length < 2) return null;
  return (
    <label className="flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-[13px] text-[#d6d6d6]">
      <MapPin size={15} aria-hidden="true" />
      <span className="sr-only">Unidade</span>
      <select
        value={current ?? ""}
        disabled={pending}
        onChange={(e) => start(() => choosePainelUnit(e.target.value))}
        className="rounded-md bg-transparent py-1 text-white outline-none [&>option]:text-ink"
      >
        <option value="">Todas as unidades</option>
        {units.map((u) => (
          <option key={u.id} value={u.id}>
            {u.name}
          </option>
        ))}
      </select>
    </label>
  );
}
