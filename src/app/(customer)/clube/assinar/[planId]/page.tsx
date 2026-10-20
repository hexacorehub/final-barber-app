import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { RELATIONSHIP_LABEL, household } from "@/domain/household";
import { loadSnapshot } from "@/server/data/store";
import { currentCustomerId } from "@/server/session";
import { SubscribeForm } from "./subscribe-form";

export const metadata: Metadata = { title: "Assinar" };

export default async function SubscribePage({ params, searchParams }: { params: Promise<{ planId: string }>; searchParams: Promise<{ para?: string; indicacao?: string }> }) {
  const { planId } = await params;
  const query = await searchParams;
  const s = await loadSnapshot();
  const plan = s.plans.find((p) => p.id === planId);
  if (!plan) notFound();
  const meId = await currentCustomerId();
  const members = household(s, meId);
  const isHolder = members.find((m) => m.customer.id === meId)?.isHolder ?? false;
  const referrer = query.indicacao ? s.customers.find((c) => c.referralCode === query.indicacao?.toUpperCase() && !members.some((m) => m.customer.id === c.id)) : undefined;

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-5 px-5 pt-4 md:px-0 md:pt-8">
      <Link href="/clube" className="flex min-h-11 items-center gap-1.5 self-start text-sm font-medium">
        <ArrowLeft size={18} aria-hidden="true" /> Planos
      </Link>
      <SubscribeForm
        plan={plan}
        isHolder={isHolder}
        initialFor={members.some((m) => m.customer.id === query.para) ? query.para! : meId}
        members={members.map((m) => ({
          id: m.customer.id,
          name: m.customer.name,
          label: m.isHolder ? "Você (titular)" : `${m.customer.relationship ? RELATIONSHIP_LABEL[m.customer.relationship] : "Na sua conta"}${m.customer.minor ? " · menor de idade" : ""}`,
          currentPlanId: m.plan?.id ?? null,
          currentPlanName: m.plan?.name.replace("Mister Club ", "") ?? null,
        }))}
        referral={referrer ? { code: referrer.referralCode, name: referrer.name.split(" ")[0] } : null}
      />
    </div>
  );
}
