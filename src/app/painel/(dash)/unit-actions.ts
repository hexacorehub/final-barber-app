"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { hasOwnerAccess } from "@/server/owner-auth";
import { UNIT_COOKIE } from "@/server/painel-scope";

export async function choosePainelUnit(unitId: string): Promise<void> {
  if (!(await hasOwnerAccess())) return;
  const jar = await cookies();
  if (unitId) jar.set(UNIT_COOKIE, unitId.slice(0, 64), { httpOnly: true, sameSite: "lax", path: "/painel", maxAge: 60 * 60 * 24 * 180 });
  else jar.delete({ name: UNIT_COOKIE, path: "/painel" });
  revalidatePath("/painel", "layout");
}
