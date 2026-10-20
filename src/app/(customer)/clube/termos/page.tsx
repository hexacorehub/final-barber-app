import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const metadata: Metadata = { title: "Termos de uso" };

export default function TermsPage() {
  return (
    <div className="flex flex-col gap-4 px-5 pt-4">
      <Link href="/clube" className="flex min-h-11 items-center gap-1.5 self-start text-sm font-medium">
        <ArrowLeft size={18} aria-hidden="true" /> Planos
      </Link>
      <h1 className="font-display text-[28px] font-semibold">Termos de uso do Mister Club</h1>
      <div className="flex flex-col gap-3 text-[15px] leading-relaxed text-ink-soft">
        <p>Os planos têm vigência por tempo indeterminado e cobrança mensal automática.</p>
        <p>O que está incluso em cada plano e as condições de uso são confirmados pela equipe da barbearia no WhatsApp antes da ativação.</p>
        <p className="rounded-xl bg-chip p-4 text-sm text-muted">O texto completo dos termos será publicado aqui pela barbearia.</p>
      </div>
    </div>
  );
}
