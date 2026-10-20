import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Bell } from "lucide-react";
import { Wordmark } from "@/components/brand";
import { DemoBar } from "@/components/demo-bar";
import { buttonStyles, cn } from "@/components/ui";
import { getStore, loadSnapshot } from "@/server/data/store";
import { canSeeApp } from "@/server/demo-access";
import { CustomerNav, CustomerTopNav } from "./customer-nav";

export const dynamic = "force-dynamic";

export default async function CustomerLayout({ children }: { children: ReactNode }) {
  if (!(await canSeeApp())) redirect("/acesso");
  const snapshot = await loadSnapshot();
  const demo = getStore().mode === "demo";
  return (
    <div className="min-h-dvh bg-white">
      <DemoBar current="customer" />
      <header className="sticky top-0 z-20 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-md items-center justify-between gap-4 px-5 md:h-[72px] md:max-w-6xl md:px-8">
          <Link href="/inicio" aria-label={`${snapshot.shop.name}, início`}>
            <Wordmark name={snapshot.shop.name} />
          </Link>
          <CustomerTopNav />
          <div className="flex items-center gap-2">
            <button type="button" aria-label="Notificações" className="flex size-11 items-center justify-center rounded-full hover:bg-chip">
              <Bell size={21} strokeWidth={1.8} aria-hidden="true" />
            </button>
            <Link href="/agendar" className={cn(buttonStyles.primary, "hidden min-h-10 px-4 text-sm lg:inline-flex")}>
              Agendar horário
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-md pb-28 md:max-w-6xl md:px-8 md:pb-16">
        {children}
        {demo ? <p className="mt-10 px-5 text-center text-xs text-faint">Versão de demonstração · preços avulsos e produtos ilustrativos · fotos: Unsplash</p> : null}
      </main>
      <CustomerNav />
    </div>
  );
}
