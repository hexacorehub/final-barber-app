import Link from "next/link";
import type { Role } from "@/domain/access";
import { getStore } from "@/server/data/store";
import { demoAccessConfigured, hasDemoAccess } from "@/server/demo-access";
import { viewAsPeople } from "@/server/staff";
import { viewAsAndOpen } from "@/app/painel/(dash)/view-as-action";
import { cn } from "./ui";

const ROLE_SHORT: Record<Role, string> = { owner: "Dono", manager: "Gerente", reception: "Recepção", barber: "Barbeiro" };
const ROLE_ORDER: Role[] = ["manager", "reception", "barber"];

/**
 * Black strip for the demonstration: switch between the customer app and the dashboard as each
 * person of the team (owner, manager, reception, barber), to show what each one sees. Shown with
 * the demo access code, or when the app runs on the demo data without a code.
 */
export async function DemoBar({ current }: { current: "customer" | string }) {
  const show = (await hasDemoAccess()) || (getStore().mode === "demo" && !demoAccessConfigured());
  if (!show) return null;
  const people = (await viewAsPeople()).sort((a, b) => ROLE_ORDER.indexOf(a.role) - ROLE_ORDER.indexOf(b.role));
  const tab = (active: boolean) =>
    cn("flex h-8 shrink-0 items-center gap-1 rounded-md px-2.5 text-xs font-semibold whitespace-nowrap sm:px-3", active ? "bg-white text-ink" : "text-[#d6d6d6] hover:text-white");

  return (
    <div className="border-b border-[#2a2a2a] bg-ink text-white">
      <div className="mx-auto flex max-w-[1200px] items-center justify-center gap-3 px-2 py-1.5 sm:justify-between sm:px-4">
        <Link href="/acesso" className="hidden shrink-0 text-xs text-[#bdbdbd] hover:text-white sm:block">
          Demonstração
        </Link>
        <nav aria-label="Trocar visão" className="no-scrollbar flex min-w-0 gap-1 overflow-x-auto rounded-lg bg-[#262626] p-0.5">
          <Link href="/inicio" aria-current={current === "customer" ? "page" : undefined} className={tab(current === "customer")}>
            Cliente
          </Link>
          <form action={viewAsAndOpen} className="contents">
            <button type="submit" name="persona" value="owner" aria-current={current === "owner" ? "page" : undefined} className={tab(current === "owner")}>
              Dono
            </button>
            {people.map((p) => (
              <button
                key={p.id}
                type="submit"
                name="persona"
                value={p.id}
                aria-current={current === p.id ? "page" : undefined}
                title={`Ver o painel como ${p.name}`}
                className={tab(current === p.id)}
              >
                {ROLE_SHORT[p.role]}
                <span className={cn("hidden font-normal sm:inline", current === p.id ? "text-muted" : "text-[#9a9a9a]")}>{p.name.split(" ")[0]}</span>
              </button>
            ))}
          </form>
        </nav>
      </div>
    </div>
  );
}
