import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Wordmark } from "@/components/brand";
import { hasOwnerAccess, passcodeConfigured } from "@/server/owner-auth";
import { EnterForm } from "./enter-form";

export const metadata: Metadata = { title: "Entrar no painel" };
export const dynamic = "force-dynamic";

export default async function EnterPage() {
  if (!passcodeConfigured() || (await hasOwnerAccess())) redirect("/painel");
  return (
    <div className="flex min-h-dvh items-center justify-center bg-ink px-5">
      <div className="flex w-full max-w-sm flex-col gap-6 rounded-2xl bg-white p-6">
        <Wordmark />
        <div>
          <h1 className="font-display text-2xl font-semibold">Painel do dono</h1>
          <p className="text-sm text-muted">Digite o código de acesso da barbearia.</p>
        </div>
        <EnterForm />
      </div>
    </div>
  );
}
