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

function useActive() {
  const path = usePathname();
  return (href: string) =>
    path === href || path.startsWith(`${href}/`) || (href === "/conta" && (path.startsWith("/galeria") || path.startsWith("/indique")));
}

/**
 * Bottom tab bar on phones. The five main screens are prefetched in full (data included) as
 * soon as the bar is on screen, so the first tap on each tab opens without waiting on the
 * server. Server data is cached, so these prefetches are cheap.
 */
export function CustomerNav() {
  const isActive = useActive();
  return (
    <nav aria-label="Navegação principal" className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-white/95 backdrop-blur md:hidden">
      <ul className="mx-auto grid max-w-md grid-cols-5 pb-[env(safe-area-inset-bottom)]">
        {ITEMS.map(({ href, label, Icon }) => {
          const active = isActive(href);
          return (
            <li key={href}>
              <Link
                href={href}
                prefetch
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

/** Links in the header on larger screens. */
export function CustomerTopNav() {
  const isActive = useActive();
  return (
    <nav aria-label="Navegação principal" className="hidden items-center gap-1 md:flex">
      {ITEMS.map(({ href, label }) => {
        const active = isActive(href);
        return (
          <Link
            key={href}
            href={href}
            prefetch
            aria-current={active ? "page" : undefined}
            className={cn("flex h-10 items-center rounded-lg px-3.5 text-sm", active ? "bg-ink font-semibold text-white" : "text-ink-soft hover:bg-chip")}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
