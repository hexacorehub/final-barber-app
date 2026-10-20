import type { ReactNode } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { Wordmark } from "@/components/brand";
import { getStore, loadSnapshot } from "@/server/data/store";
import { CustomerNav } from "./customer-nav";

export const dynamic = "force-dynamic";

export default async function CustomerLayout({ children }: { children: ReactNode }) {
  const snapshot = await loadSnapshot();
  const demo = getStore().mode === "demo";
  return (
    <div className="min-h-dvh bg-white">
      <header className="sticky top-0 z-20 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-md items-center justify-between px-5">
          <Link href="/inicio" aria-label={`${snapshot.shop.name}, início`}>
            <Wordmark name={snapshot.shop.name} />
          </Link>
          <button type="button" aria-label="Notificações" className="flex size-11 items-center justify-center rounded-full hover:bg-chip">
            <Bell size={21} strokeWidth={1.8} aria-hidden="true" />
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-md pb-28">{children}</main>
      {demo ? <p className="mx-auto -mt-24 mb-24 max-w-md px-5 text-center text-xs text-faint">Versão de demonstração · preços avulsos e produtos ilustrativos</p> : null}
      <CustomerNav />
    </div>
  );
}
