"use server";

import { redirect } from "next/navigation";
import { grantDemoAccess, revokeDemoAccess } from "@/server/demo-access";

export async function enterDemo(_: { error: string | null }, form: FormData): Promise<{ error: string | null }> {
  const ok = await grantDemoAccess(String(form.get("codigo") ?? ""));
  if (!ok) return { error: "Código incorreto." };
  redirect("/acesso");
}

export async function leaveDemo(): Promise<void> {
  await revokeDemoAccess();
  redirect("/acesso");
}
