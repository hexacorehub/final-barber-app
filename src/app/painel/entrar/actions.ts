"use server";

import { redirect } from "next/navigation";
import { grantOwnerAccess, revokeOwnerAccess } from "@/server/owner-auth";
import { signInStaff, signOutStaff } from "@/server/staff";
import { BLOCKED_MESSAGE, clearFailures, isBlocked, recordFailure } from "@/server/rate-limit";

export async function enterDashboard(_: { error: string | null }, form: FormData): Promise<{ error: string | null }> {
  if (isBlocked("passcode")) return { error: BLOCKED_MESSAGE };
  const ok = await grantOwnerAccess(String(form.get("passcode") ?? ""));
  if (!ok) {
    recordFailure("passcode");
    return { error: "Código incorreto." };
  }
  clearFailures("passcode");
  redirect("/painel");
}

export async function enterAsStaff(_: { error: string | null }, form: FormData): Promise<{ error: string | null }> {
  const email = String(form.get("email") ?? "").slice(0, 200);
  const key = `staff:${email.trim().toLowerCase()}`;
  if (isBlocked(key)) return { error: BLOCKED_MESSAGE };
  const ok = await signInStaff(email, String(form.get("password") ?? "").slice(0, 200));
  if (!ok) {
    recordFailure(key);
    return { error: "E-mail ou senha incorretos." };
  }
  clearFailures(key);
  redirect("/painel");
}

export async function leaveDashboard(): Promise<void> {
  await revokeOwnerAccess();
  await signOutStaff();
  redirect("/painel/entrar");
}
