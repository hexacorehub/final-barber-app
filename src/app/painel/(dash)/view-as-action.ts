"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { hasOwnerAccess } from "@/server/owner-auth";
import { canViewAs, listStaff, VIEW_AS_COOKIE } from "@/server/staff";
import { UNIT_COOKIE } from "@/server/painel-scope";

export async function viewAs(staffId: string): Promise<void> {
  if (!canViewAs() || !(await hasOwnerAccess())) return;
  const jar = await cookies();
  if (staffId === "owner" || !(await listStaff()).some((x) => x.id === staffId)) jar.delete({ name: VIEW_AS_COOKIE, path: "/painel" });
  else jar.set(VIEW_AS_COOKIE, staffId, { httpOnly: true, sameSite: "lax", path: "/painel", maxAge: 60 * 60 * 8 });
  jar.delete({ name: UNIT_COOKIE, path: "/painel" });
  revalidatePath("/painel", "layout");
}
