import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Gift, Users } from "lucide-react";
import { Badge } from "@/components/ui";
import { firstName } from "@/components/format";
import { household } from "@/domain/household";
import { upgradeOptions } from "@/domain/metrics";
import { loadSnapshot } from "@/server/data/store";
import { currentCustomerId } from "@/server/session";
import { ClubPlans } from "./club-plans";

export const metadata: Metadata = { title: "Mister Club" };

export default async function ClubPage({ searchParams }: { searchParams: Promise<{ para?: string; indicacao?: string }> }) {
  const params = await searchParams;
  const s = await loadSnapshot();
  const meId = await currentCustomerId();
  const members = household(s, meId);
  const me = members.find((m) => m.customer.id === meId);
  const target = members.find((m) => m.customer.id === params.para) ?? me;
  const haircut = s.services.find((x) => x.coverage === "haircut" && x.category === "hair");
  const beard = s.services.find((x) => x.coverage === "beard");

  const referrer = params.indicacao ? s.customers.find((c) => c.referralCode === params.indicacao?.toUpperCase()) : undefined;
  const validReferral = referrer && !members.some((m) => m.customer.id === referrer.id) ? referrer : undefined;

  const query = new URLSearchParams();
  if (target && target.customer.id !== meId) query.set("para", target.customer.id);
  if (validReferral) query.set("indicacao", validReferral.referralCode);

  return (
    <div className="flex flex-col gap-6 px-5 pt-5 md:gap-8 md:px-0 md:pt-8">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-[28px] font-semibold md:text-[36px]">Mister Club</h1>
        <p className="text-sm text-muted md:text-base">Corte e barba sempre em dia, com uma mensalidade só. Um plano por pessoa, vários na mesma conta.</p>
        <div className="flex flex-wrap gap-2">
          <Badge>{s.shop.memberCountLabel}</Badge>
          <Badge>Sem fidelidade mínima</Badge>
          <Badge>Planos para a família na mesma conta</Badge>
        </div>
      </div>

      {validReferral ? (
        <div className="flex items-center gap-3 rounded-2xl bg-ok-bg p-4 text-ok">
          <Gift size={20} aria-hidden="true" />
          <p className="text-sm">
            Você veio pelo convite de <strong>{firstName(validReferral.name)}</strong>. Ao assinar, {firstName(validReferral.name)} ganha 50% na próxima mensalidade.
          </p>
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        {target && target.customer.id !== meId ? (
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-ink p-4 text-white md:col-span-2">
            <span className="flex flex-col">
              <span className="text-[13px] text-[#cfcfcf]">Escolhendo plano para</span>
              <span className="font-display text-lg">{target.customer.name}</span>
            </span>
            <Link href="/clube" className="text-sm underline">
              Para mim
            </Link>
          </div>
        ) : me?.plan ? (
          <Link href="/conta" className="flex items-center justify-between gap-3 rounded-2xl bg-ink p-4 text-white">
            <span className="flex flex-col">
              <span className="text-[13px] text-[#cfcfcf]">Seu plano</span>
              <span className="font-display text-lg">{me.plan.name.replace("Mister Club ", "")}</span>
            </span>
            <span className="flex items-center gap-1 text-sm">
              Gerenciar <ChevronRight size={18} aria-hidden="true" />
            </span>
          </Link>
        ) : null}
        {me?.isHolder && (!target || target.customer.id === meId) ? (
          <Link href="/conta#familia" className="flex items-center justify-between gap-3 rounded-2xl border border-line p-4 hover:border-ink">
            <span className="flex items-center gap-3">
              <Users size={20} aria-hidden="true" />
              <span className="flex flex-col">
                <span className="text-[15px] font-semibold">Plano para alguém da família</span>
                <span className="text-[13px] text-muted">
                  {members.length > 1 ? `${members.length - 1} ${members.length === 2 ? "pessoa" : "pessoas"} na sua conta` : "Filho, sogro, parceiro: cada um com o seu"}
                </span>
              </span>
            </span>
            <ChevronRight size={18} aria-hidden="true" />
          </Link>
        ) : null}
      </div>

      <ClubPlans
        plans={s.plans}
        haircutCents={haircut?.priceCents ?? 0}
        beardCents={beard?.priceCents ?? 0}
        currentPlanId={target?.plan?.id ?? null}
        targetName={target && target.customer.id !== meId ? firstName(target.customer.name) : null}
        upgrades={target?.plan ? upgradeOptions(s.plans, target.plan) : []}
        query={query.toString()}
      />
    </div>
  );
}
