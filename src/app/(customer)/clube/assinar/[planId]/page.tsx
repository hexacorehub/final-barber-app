import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { loadSnapshot } from "@/server/data/store";
import { SubscribeForm } from "./subscribe-form";

export const metadata: Metadata = { title: "Assinar" };

export default async function SubscribePage({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = await params;
  const s = await loadSnapshot();
  const plan = s.plans.find((p) => p.id === planId);
  if (!plan) notFound();
  return (
    <div className="flex flex-col gap-5 px-5 pt-4">
      <Link href="/clube" className="flex min-h-11 items-center gap-1.5 self-start text-sm font-medium">
        <ArrowLeft size={18} aria-hidden="true" /> Planos
      </Link>
      <SubscribeForm plan={plan} />
    </div>
  );
}
