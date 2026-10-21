import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, LayoutDashboard, Smartphone } from "lucide-react";
import { MustacheMark } from "@/components/brand";
import { TestDataNotice } from "@/components/test-data-notice";
import { canSeeApp, hasDemoAccess } from "@/server/demo-access";
import { loadSnapshot } from "@/server/data/store";
import { leaveDemo } from "./actions";
import { DemoEnterForm } from "./enter-form";

export const metadata: Metadata = { title: "Acesso de demonstração" };
export const dynamic = "force-dynamic";

export default async function AccessPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const open = await canSeeApp();
  const s = await loadSnapshot();

  return (
    <div className="flex min-h-dvh items-center justify-center bg-ink px-5 py-10">
      <div className="flex w-full max-w-xl flex-col gap-6 rounded-2xl bg-white p-6 sm:p-8">
        <div className="flex items-center gap-2.5">
          <MustacheMark />
          <span className="font-display text-[19px] font-semibold tracking-[0.12em]">{s.shop.name}</span>
        </div>
        {open ? <Hub shopName={s.shop.name} canLeave={await hasDemoAccess()} /> : <Locked error={(await searchParams).erro === "1"} />}
      </div>
    </div>
  );
}

function Locked({ error }: { error: boolean }) {
  return (
    <>
      <div>
        <h1 className="font-display text-2xl font-semibold">Acesso de demonstração</h1>
        <p className="text-sm text-muted">Digite o código que você recebeu para ver o app do cliente e o painel do dono.</p>
      </div>
      <DemoEnterForm initialError={error} />
    </>
  );
}

function Hub({ shopName, canLeave }: { shopName: string; canLeave: boolean }) {
  const views = [
    {
      href: "/inicio",
      Icon: Smartphone,
      title: "App do cliente",
      text: `O que o cliente da ${shopName} vê: agendar, Mister Club, produtos e conta. Você entra como o Rafael, assinante que paga o clube dele e do filho.`,
    },
    {
      href: "/painel",
      Icon: LayoutDashboard,
      title: "Painel do dono",
      text: "Faturamento por barbeiro, indicadores e indicações do clube, vitrine e financeiro.",
    },
  ];
  return (
    <>
      <div>
        <h1 className="font-display text-2xl font-semibold">Escolha a visão</h1>
        <p className="text-sm text-muted">Dá para trocar a qualquer momento pela barra preta no topo.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {views.map(({ href, Icon, title, text }) => (
          <Link key={href} href={href} className="group flex flex-col gap-3 rounded-2xl border-[1.5px] border-line p-5 hover:border-ink">
            <span className="flex size-11 items-center justify-center rounded-full bg-ink text-white">
              <Icon size={20} aria-hidden="true" />
            </span>
            <span className="font-display text-lg font-semibold">{title}</span>
            <span className="text-sm text-muted">{text}</span>
            <span className="mt-auto flex items-center gap-1 text-sm font-semibold">
              Abrir <ArrowRight size={16} className="transition group-hover:translate-x-0.5" aria-hidden="true" />
            </span>
          </Link>
        ))}
      </div>
      <TestDataNotice />
      {canLeave ? (
        <form action={leaveDemo}>
          <button type="submit" className="min-h-11 text-sm text-muted underline-offset-2 hover:underline">
            Sair do acesso de demonstração
          </button>
        </form>
      ) : null}
    </>
  );
}
