"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Crown, House, ShoppingBag, UserRound } from "lucide-react";
import { cn } from "@/components/ui";

const ITEMS = [
  { href: "/inicio", label: "Início", Icon: House },
  { href: "/agendar", label: "Agendar", Icon: CalendarDays },
  { href: "/clube", label: "Clube", Icon: Crown },
  { href: "/produtos", label: "Produtos", Icon: ShoppingBag },
  { href: "/conta", label: "Conta", Icon: UserRound },
];

export function CustomerNav() {
  const path = usePathname();
  return (
    <nav aria-label="Navegação principal" className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white/95 backdrop-blur">
      <ul className="mx-auto grid max-w-md grid-cols-5 pb-[env(safe-area-inset-bottom)]">
        {ITEMS.map(({ href, label, Icon }) => {
          const active = path === href || path.startsWith(`${href}/`) || (href === "/conta" && path.startsWith("/galeria"));
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn("flex h-[68px] flex-col items-center justify-center gap-1 text-[11px]", active ? "font-semibold text-ink" : "font-medium text-faint")}
              >
                <Icon size={22} strokeWidth={active ? 2.1 : 1.7} aria-hidden="true" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
