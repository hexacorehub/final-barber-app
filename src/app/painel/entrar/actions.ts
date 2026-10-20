"use server";

import { redirect } from "next/navigation";
import { grantOwnerAccess, revokeOwnerAccess } from "@/server/owner-auth";

export async function enterDashboard(_: { error: string | null }, form: FormData): Promise<{ error: string | null }> {
  const ok = await grantOwnerAccess(String(form.get("passcode") ?? ""));
  if (!ok) return { error: "Código incorreto." };
  redirect("/painel");
}

export async function leaveDashboard(): Promise<void> {
  await revokeOwnerAccess();
  redirect("/painel/entrar");
}
