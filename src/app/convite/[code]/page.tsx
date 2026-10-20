import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check } from "lucide-react";
import { Wordmark } from "@/components/brand";
import { Photo } from "@/components/photo";
import { buttonStyles, cn } from "@/components/ui";
import { formatMoney } from "@/domain/money";
import { loadSnapshot } from "@/server/data/store";

export const metadata: Metadata = { title: "Convite para o Mister Club" };
export const dynamic = "force-dynamic";

/** Public page a member shares. Shows only the shop, the plans and the referrer's first name. */
export default async function InvitePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const s = await loadSnapshot();
  const referrer = s.customers.find((c) => c.referralCode === code.toUpperCase());
  if (!referrer) notFound();
  const first = referrer.name.split(" ")[0];
  const cheapest = [...s.plans].sort((a, b) => a.priceCents - b.priceCents)[0];

  return (
    <div className="min-h-dvh bg-white">
      <div className="relative overflow-hidden bg-ink text-white">
        <Photo src={s.shop.coverPhotoUrl} alt="Interior da barbearia" className="absolute inset-0 h-full w-full opacity-40" fallback="" />
        <div className="relative mx-auto flex max-w-3xl flex-col gap-5 px-5 pt-6 pb-12 md:px-8 md:pt-10 md:pb-16">
          <div className="text-white">
            <Wordmark name={s.shop.name} />
          </div>
          <p className="text-sm text-[#e0e0e0]">{first} te convidou</p>
          <h1 className="max-w-xl font-display text-[36px] leading-[1.05] font-semibold md:text-[48px]">Corte e barba sempre em dia no Mister Club</h1>
          <p className="max-w-lg text-[15px] text-[#e0e0e0]">
            {s.shop.memberCountLabel} · {s.shop.ratingLabel}. Planos a partir de {formatMoney(cheapest.priceCents)} por mês, sem fidelidade.
          </p>
          <Link href={`/clube?indicacao=${referrer.referralCode}`} className={cn(buttonStyles.inverse, "self-start")}>
            Ver planos e assinar
          </Link>
        </div>
      </div>
      <div className="mx-auto grid max-w-3xl gap-3 px-5 py-8 sm:grid-cols-2 md:px-8">
        {[...s.plans]
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 rounded-2xl border border-line p-4">
              <span className="flex flex-col">
                <span className="font-semibold">{p.name.replace("Mister Club ", "")}</span>
                <span className="flex gap-2 text-xs text-muted">
                  {p.covers.map((c) => (
                    <span key={c} className="flex items-center gap-1">
                      <Check size={12} aria-hidden="true" /> {c === "haircut" ? "Corte" : "Barba"}
                    </span>
                  ))}
                </span>
              </span>
              <span className="font-display text-lg tracking-normal">{formatMoney(p.priceCents)}</span>
            </div>
          ))}
      </div>
    </div>
  );
}
