"use server";

import { redirect } from "next/navigation";
import { signInCustomer, signOutCustomer, signUpCustomer } from "@/server/customer-auth";

export async function signIn(_: { error: string | null }, form: FormData): Promise<{ error: string | null }> {
  const ok = await signInCustomer(String(form.get("identifier") ?? "").slice(0, 200), String(form.get("password") ?? "").slice(0, 200));
  if (!ok) return { error: "CPF/e-mail ou senha incorretos." };
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
