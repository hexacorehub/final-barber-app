import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Wordmark } from "@/components/brand";
import { canSeeApp } from "@/server/demo-access";
import { passcodeConfigured } from "@/server/owner-auth";
import { currentStaff, staffLoginEnabled } from "@/server/staff";
import { EnterForm } from "./enter-form";
import { StaffForm } from "./staff-form";

export const metadata: Metadata = { title: "Entrar no painel" };
export const dynamic = "force-dynamic";

export default async function EnterPage() {
  if (!(await canSeeApp())) redirect("/acesso");
  if ((await currentStaff()) || (!passcodeConfigured() && !staffLoginEnabled())) redirect("/painel");
  const staffLogin = staffLoginEnabled();
  return (
    <div className="flex min-h-dvh items-center justify-center bg-ink px-5">
      <div className="flex w-full max-w-sm flex-col gap-6 rounded-2xl bg-white p-6">
        <Wordmark />
        <div>
          <h1 className="font-display text-2xl font-semibold">{staffLogin ? "Painel da barbearia" : "Painel do dono"}</h1>
          <p className="text-sm text-muted">{staffLogin ? "Entre com o e-mail e a senha que o dono criou para você." : "Digite o código de acesso da barbearia."}</p>
        </div>
        {staffLogin ? <StaffForm /> : null}
        {passcodeConfigured() ? (
          <>
            {staffLogin ? <p className="text-center text-xs text-muted">É o dono? Use o código de acesso.</p> : null}
            <EnterForm />
          </>
        ) : null}
      </div>
    </div>
  );
}
