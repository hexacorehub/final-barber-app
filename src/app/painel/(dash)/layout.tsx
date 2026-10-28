import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { MustacheMark } from "@/components/brand";
import { getStore, loadSnapshot } from "@/server/data/store";
import { DemoBar } from "@/components/demo-bar";
import { canSeeApp, demoAccessConfigured, hasDemoAccess } from "@/server/demo-access";
import { dashboardProtected, passcodeConfigured } from "@/server/owner-auth";
import { leaveDashboard } from "../entrar/actions";
import { TEST_DATA_NOTICE } from "@/components/test-data-notice";
import { showsTestData } from "@/server/test-data";
import { OwnerNav } from "./owner-nav";
import { RefreshDemoButton } from "./refresh-demo-button";
import { UnitSwitcher } from "./unit-switcher";
import { painelUnit } from "@/server/painel-scope";
import { allowedUnits, can, ROLE_LABEL, type Permission } from "@/domain/access";
import { currentStaff } from "@/server/staff";
import type { NavItem } from "./owner-nav";

const NAV: (NavItem & { needs: Permission[] })[] = [
  { href: "/painel", label: "Visão geral", needs: [] },
  { href: "/painel/assistente", label: "Assistente", needs: ["revenue"] },
  { href: "/painel/barbeiros", label: "Barbeiros", needs: ["revenue", "agenda"] },
  { href: "/painel/clube", label: "Mister Club", needs: ["subscriptions"] },
  { href: "/painel/assinaturas", label: "Assinaturas", needs: ["subscriptions"] },
  { href: "/painel/candidatos", label: "Candidatos", needs: ["candidates"] },
  { href: "/painel/whatsapp", label: "WhatsApp", needs: ["messages_utility", "messages_marketing"] },
  { href: "/painel/produtos", label: "Produtos", needs: ["products"] },
  { href: "/painel/financeiro", label: "Financeiro", needs: ["finance"] },
  { href: "/painel/equipe", label: "Equipe", needs: ["team"] },
];

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  if (!(await canSeeApp())) redirect("/acesso");
  const s = await loadSnapshot();
  const demo = getStore().mode === "demo";
  const gated = dashboardProtected();
  const testData = showsTestData();
  const canLeave = passcodeConfigured() && !(await hasDemoAccess());
  const unit = await painelUnit();
  const staff = await currentStaff();
  if (!staff) redirect("/painel/entrar");
  // Pages of the dashboard the person's access covers ("Assistente" needs the whole shop's numbers).
  const items = NAV.filter((i) => !i.needs.length || i.needs.some((p) => (i.href === "/painel/assistente" ? can(staff, p) === "all" || can(staff, p) === "units" : can(staff, p))));
  const allowed = allowedUnits(staff);
  const switcherUnits = s.units.filter((u) => !allowed || allowed.includes(u.id));

  return (
    <div className="min-h-dvh bg-white">
      <DemoBar current={staff.id} />
      <header className="bg-ink text-white">
        <div className="mx-auto flex max-w-[1200px] flex-col gap-1 px-5 pt-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <MustacheMark color="#fff" />
              <span className="font-display text-[19px] font-semibold tracking-[0.12em]">{s.shop.name}</span>
              <span className="border-l border-[#3a3a3a] pl-3 text-[13px] text-[#bdbdbd]">{staff.role === "owner" ? "Painel do dono" : `${staff.name.split(" (")[0]} · ${ROLE_LABEL[staff.role]}`}</span>
            </div>
            <div className="flex items-center gap-1 text-[13px]">
              <UnitSwitcher units={switcherUnits.map((u) => ({ id: u.id, name: u.name }))} current={unit?.id ?? null} allowAll={!allowed} />
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
          <OwnerNav items={items} />
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
