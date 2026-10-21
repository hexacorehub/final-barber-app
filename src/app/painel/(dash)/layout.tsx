import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MustacheMark } from "@/components/brand";
import { getStore, loadSnapshot } from "@/server/data/store";
import { DemoBar } from "@/components/demo-bar";
import { canSeeApp, demoAccessConfigured, hasDemoAccess } from "@/server/demo-access";
import { dashboardProtected, hasOwnerAccess, passcodeConfigured } from "@/server/owner-auth";
import { leaveDashboard } from "../entrar/actions";
import { TEST_DATA_NOTICE } from "@/components/test-data-notice";
import { showsTestData } from "@/server/test-data";
import { OwnerNav } from "./owner-nav";
import { RefreshDemoButton } from "./refresh-demo-button";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  if (!(await canSeeApp())) redirect("/acesso");
  if (!(await hasOwnerAccess())) redirect("/painel/entrar");
  const s = await loadSnapshot();
  const demo = getStore().mode === "demo";
  const gated = dashboardProtected();
  const testData = showsTestData();
  const canLeave = passcodeConfigured() && !(await hasDemoAccess());

  return (
    <div className="min-h-dvh bg-white">
      <DemoBar current="owner" />
      <header className="bg-ink text-white">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-1 px-5 pt-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <MustacheMark color="#fff" />
              <span className="font-display text-[19px] font-semibold tracking-[0.12em]">{s.shop.name}</span>
              <span className="border-l border-[#3a3a3a] pl-3 text-[13px] text-[#bdbdbd]">Painel do dono</span>
            </div>
            <div className="flex items-center gap-1 text-[13px]">
              <Link href="/inicio" className="flex min-h-11 items-center rounded-lg px-3 text-[#d6d6d6] hover:text-white">
                Ver app do cliente
              </Link>
              {canLeave ? (
                <form action={leaveDashboard}>
                  <button type="submit" className="flex min-h-11 items-center rounded-lg px-3 text-[#d6d6d6] hover:text-white">
                    Sair
                  </button>
                </form>
              ) : null}
            </div>
          </div>
          <OwnerNav />
        </div>
      </header>
      {testData || !gated ? (
        <div className="border-b border-line bg-chip">
          <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-2 px-5 py-2 text-[13px] text-ink-soft">
            <p>
              {testData ? TEST_DATA_NOTICE : null}
              {!gated ? `${testData ? " " : ""}Painel sem código de acesso: defina DEMO_ACCESS_CODE ou PAINEL_PASSCODE antes de compartilhar o link.` : null}
            </p>
            {!demo && demoAccessConfigured() ? <RefreshDemoButton /> : null}
          </div>
        </div>
      ) : null}
      <main className="mx-auto flex max-w-[1200px] flex-col gap-6 px-5 pt-7 pb-16">{children}</main>
      <footer className="mx-auto max-w-[1200px] px-5 pb-8 text-xs text-faint">Final Barber · gestão para barbearias</footer>
    </div>
  );
}
