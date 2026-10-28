import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Wordmark } from "@/components/brand";
import { canSeeApp } from "@/server/demo-access";
import { customerLoginEnabled, sessionCustomerId } from "@/server/customer-auth";
import { loadSnapshot } from "@/server/data/store";
import { SignInForm } from "./forms";

export const metadata: Metadata = { title: "Entrar" };
export const dynamic = "force-dynamic";

export default async function SignInPage() {
  if (!(await canSeeApp())) redirect("/acesso");
  const s = await loadSnapshot();
  const enabled = customerLoginEnabled();
  if (enabled && (await sessionCustomerId())) redirect("/inicio");
  return (
    <div className="flex min-h-dvh items-center justify-center bg-chip px-5 py-10">
      <div className="flex w-full max-w-sm flex-col gap-6 rounded-2xl bg-white p-6">
        <Wordmark name={s.shop.name} />
        <div>
          <h1 className="font-display text-2xl font-semibold">Entrar</h1>
          <p className="text-sm text-muted">Com o seu CPF ou e-mail.</p>
        </div>
        {enabled ? (
          <>
            <SignInForm />
            <p className="text-center text-sm">
              Ainda não tem conta?{" "}
              <Link href="/criar-conta" className="font-semibold underline">
                Criar conta
              </Link>
            </p>
          </>
        ) : (
          <p className="rounded-xl bg-chip p-4 text-sm text-ink-soft">
            O login de clientes está desligado nesta versão de demonstração.{" "}
            <Link href="/inicio" className="font-semibold underline">
              Abrir o app como cliente de exemplo
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
