"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { hasOwnerAccess } from "@/server/owner-auth";
import { canViewAs, VIEW_AS_COOKIE, viewAsPeople } from "@/server/staff";
import { UNIT_COOKIE } from "@/server/painel-scope";

export async function viewAs(staffId: string): Promise<void> {
  if (!canViewAs() || !(await hasOwnerAccess())) return;
  const jar = await cookies();
  if (staffId === "owner" || !(await viewAsPeople()).some((x) => x.id === staffId)) jar.delete({ name: VIEW_AS_COOKIE, path: "/painel" });
  else jar.set(VIEW_AS_COOKIE, staffId, { httpOnly: true, sameSite: "lax", path: "/painel", maxAge: 60 * 60 * 8 });
  jar.delete({ name: UNIT_COOKIE, path: "/painel" });
  revalidatePath("/painel", "layout");
}

/** From the demo bar: switch persona and open the dashboard. */
export async function viewAsAndOpen(form: FormData): Promise<void> {
  await viewAs(String(form.get("persona") ?? "owner"));
  redirect("/painel");
}
