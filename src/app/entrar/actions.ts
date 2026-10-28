"use server";

import { redirect } from "next/navigation";
import { signInCustomer, signOutCustomer, signUpCustomer } from "@/server/customer-auth";
import { BLOCKED_MESSAGE, clearFailures, isBlocked, recordFailure } from "@/server/rate-limit";

export async function signIn(_: { error: string | null }, form: FormData): Promise<{ error: string | null }> {
  const identifier = String(form.get("identifier") ?? "").slice(0, 200);
  const key = `customer:${identifier.trim().toLowerCase().replace(/[.\-\s]/g, "")}`;
  if (isBlocked(key)) return { error: BLOCKED_MESSAGE };
  const ok = await signInCustomer(identifier, String(form.get("password") ?? "").slice(0, 200));
  if (!ok) {
    recordFailure(key);
    return { error: "CPF/e-mail ou senha incorretos." };
  }
  clearFailures(key);
  redirect("/inicio");
}

export async function signUp(_: { error: string | null; field: string | null }, form: FormData): Promise<{ error: string | null; field: string | null }> {
  const res = await signUpCustomer({
    name: String(form.get("name") ?? "").slice(0, 80),
    cpf: String(form.get("cpf") ?? "").slice(0, 20),
    email: String(form.get("email") ?? "").slice(0, 120),
    phone: String(form.get("phone") ?? "").slice(0, 20),
    password: String(form.get("password") ?? "").slice(0, 200),
  });
  if (!res.ok) return { error: res.error, field: res.field };
  redirect("/inicio");
}

export async function signOut(): Promise<void> {
  await signOutCustomer();
  redirect("/entrar");
}
