import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Wordmark } from "@/components/brand";
import { canSeeApp } from "@/server/demo-access";
import { customerLoginEnabled } from "@/server/customer-auth";
import { loadSnapshot } from "@/server/data/store";
import { SignUpForm } from "../entrar/forms";

export const metadata: Metadata = { title: "Criar conta" };
export const dynamic = "force-dynamic";

export default async function SignUpPage() {
  if (!(await canSeeApp())) redirect("/acesso");
  if (!customerLoginEnabled()) redirect("/entrar");
  const s = await loadSnapshot();
  return (
    <div className="flex min-h-dvh items-center justify-center bg-chip px-5 py-10">
      <div className="flex w-full max-w-sm flex-col gap-6 rounded-2xl bg-white p-6">
        <Wordmark name={s.shop.name} />
        <div>
          <h1 className="font-display text-2xl font-semibold">Criar conta</h1>
          <p className="text-sm text-muted">Agende pelo app, assine o clube e cuide da família numa conta só.</p>
        </div>
        <SignUpForm />
        <p className="text-center text-sm">
          Já tem conta?{" "}
          <Link href="/entrar" className="font-semibold underline">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
