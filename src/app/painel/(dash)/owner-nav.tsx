"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui";

export interface NavItem {
  href: string;
  label: string;
}

export function OwnerNav({ items }: { items: NavItem[] }) {
  const path = usePathname();
  return (
    <nav aria-label="Seções do painel" className="no-scrollbar -mx-1 flex gap-1 overflow-x-auto">
      {items.map((i) => {
        const active = i.href === "/painel" ? path === "/painel" : path.startsWith(i.href);
        return (
          <Link
            key={i.href}
            href={i.href}
            prefetch
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-11 shrink-0 items-center border-b-2 px-3 text-sm whitespace-nowrap",
              active ? "border-white font-semibold text-white" : "border-transparent text-[#bdbdbd] hover:text-white",
            )}
          >
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
