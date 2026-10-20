import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui";
import { customerSummary } from "@/domain/metrics";
import { loadSnapshot } from "@/server/data/store";
import { currentCustomerId } from "@/server/session";
import { ClubPlans } from "./club-plans";

export const metadata: Metadata = { title: "Mister Club" };

export default async function ClubPage() {
  const s = await loadSnapshot();
  const me = customerSummary(s, await currentCustomerId());
  const haircut = s.services.find((x) => x.coverage === "haircut" && x.category === "hair");
  const beard = s.services.find((x) => x.coverage === "beard");

  return (
    <div className="flex flex-col gap-6 px-5 pt-5">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-[28px] font-semibold">Mister Club</h1>
        <p className="text-sm text-muted">Corte e barba sempre em dia, com uma mensalidade só.</p>
        <div className="flex flex-wrap gap-2">
          <Badge>{s.shop.memberCountLabel}</Badge>
          <Badge>Sem fidelidade mínima</Badge>
        </div>
      </div>

      {me?.plan ? (
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

      <ClubPlans plans={s.plans} haircutCents={haircut?.priceCents ?? 0} beardCents={beard?.priceCents ?? 0} currentPlanId={me?.plan?.id ?? null} />
    </div>
  );
}
