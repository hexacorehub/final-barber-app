import Link from "next/link";
import { hasDemoAccess } from "@/server/demo-access";
import { cn } from "./ui";

/** Black strip shown to the demo access, to switch between the customer and owner views. */
export async function DemoBar({ current }: { current: "customer" | "owner" }) {
  if (!(await hasDemoAccess())) return null;
  const tab = (active: boolean) => cn("flex h-8 items-center rounded-md px-3 text-xs font-semibold", active ? "bg-white text-ink" : "text-[#d6d6d6] hover:text-white");
  return (
    <div className="border-b border-[#2a2a2a] bg-ink text-white">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between gap-2 px-4 py-1.5">
        <Link href="/acesso" className="text-xs text-[#bdbdbd] hover:text-white">
          Demonstração
        </Link>
        <nav aria-label="Trocar visão" className="flex gap-1 rounded-lg bg-[#262626] p-0.5">
          <Link href="/inicio" aria-current={current === "customer" ? "page" : undefined} className={tab(current === "customer")}>
            Cliente
          </Link>
          <Link href="/painel" aria-current={current === "owner" ? "page" : undefined} className={tab(current === "owner")}>
            Dono
          </Link>
        </nav>
      </div>
    </div>
  );
}
