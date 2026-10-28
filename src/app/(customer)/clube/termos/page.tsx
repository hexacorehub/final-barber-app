import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { referralRules, referralRulesText } from "@/domain/referral-rules";
import { loadSnapshot } from "@/server/data/store";

export const metadata: Metadata = { title: "Termos de uso" };

export default async function TermsPage() {
  const s = await loadSnapshot();
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 px-5 pt-4 md:px-0 md:pt-8">
      <Link href="/clube" className="flex min-h-11 items-center gap-1.5 self-start text-sm font-medium">
        <ArrowLeft size={18} aria-hidden="true" /> Planos
      </Link>
      <h1 className="font-display text-[28px] font-semibold">Termos de uso do Mister Club</h1>
      <div className="flex flex-col gap-3 text-[15px] leading-relaxed text-ink-soft">
        <p>Os planos têm vigência por tempo indeterminado e cobrança mensal automática.</p>
        <p>O que está incluso em cada plano e as condições de uso são confirmados pela equipe da barbearia no WhatsApp antes da ativação.</p>
        <h2 className="mt-2 font-display text-lg font-semibold text-ink">Programa de indicação</h2>
        <ul className="flex list-disc flex-col gap-1.5 pl-5">
          {referralRulesText(referralRules(s)).map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
        <p className="rounded-xl bg-chip p-4 text-sm text-muted">O texto completo dos termos será publicado aqui pela barbearia.</p>
      </div>
    </div>
  );
}
