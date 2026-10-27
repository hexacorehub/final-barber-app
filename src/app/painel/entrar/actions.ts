"use server";

import { redirect } from "next/navigation";
import { grantOwnerAccess, revokeOwnerAccess } from "@/server/owner-auth";
import { signInStaff, signOutStaff } from "@/server/staff";

export async function enterDashboard(_: { error: string | null }, form: FormData): Promise<{ error: string | null }> {
  const ok = await grantOwnerAccess(String(form.get("passcode") ?? ""));
  if (!ok) return { error: "Código incorreto." };
  redirect("/painel");
}

export async function enterAsStaff(_: { error: string | null }, form: FormData): Promise<{ error: string | null }> {
  const ok = await signInStaff(String(form.get("email") ?? "").slice(0, 200), String(form.get("password") ?? "").slice(0, 200));
  if (!ok) return { error: "E-mail ou senha incorretos." };
  redirect("/painel");
}

export async function leaveDashboard(): Promise<void> {
  await revokeOwnerAccess();
  await signOutStaff();
  redirect("/painel/entrar");
}
