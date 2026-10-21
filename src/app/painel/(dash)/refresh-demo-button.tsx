"use client";

import { useFormStatus } from "react-dom";
import { refreshDemoData } from "./demo-actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="min-h-9 rounded-lg border border-ink px-3 text-[13px] font-semibold disabled:opacity-60">
      {pending ? "Atualizando… (uns 20 segundos)" : "Atualizar datas da demonstração"}
    </button>
  );
}

export function RefreshDemoButton() {
  return (
    <form action={refreshDemoData}>
      <Submit />
    </form>
  );
}
