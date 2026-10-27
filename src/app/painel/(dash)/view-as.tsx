"use client";

import { useTransition } from "react";
import { Eye } from "lucide-react";
import { viewAs } from "./view-as-action";

/** Demo only: see the dashboard as someone of the team. */
export function ViewAs({ people, current }: { people: { id: string; label: string }[]; current: string }) {
  const [pending, start] = useTransition();
  return (
    <label className="flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-[13px] text-[#d6d6d6]">
      <Eye size={15} aria-hidden="true" />
      <span>Ver como</span>
      <select value={current} disabled={pending} onChange={(e) => start(() => viewAs(e.target.value))} className="rounded-md bg-transparent py-1 text-white outline-none [&>option]:text-ink">
        {people.map((p) => (
          <option key={p.id} value={p.id}>
            {p.label}
          </option>
        ))}
      </select>
    </label>
  );
}
