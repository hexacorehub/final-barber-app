"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { UNIT_COOKIE } from "@/server/painel-scope";
import { allowedUnits } from "@/domain/access";
import { currentStaff } from "@/server/staff";

export async function choosePainelUnit(unitId: string): Promise<void> {
  const staff = await currentStaff();
  if (!staff) return;
  const allowed = staff ? allowedUnits(staff) : null;
  if (allowed && (!unitId || !allowed.includes(unitId))) return;
  const jar = await cookies();
  if (unitId) jar.set(UNIT_COOKIE, unitId.slice(0, 64), { httpOnly: true, sameSite: "lax", path: "/painel", maxAge: 60 * 60 * 24 * 180 });
  else jar.delete({ name: UNIT_COOKIE, path: "/painel" });
  revalidatePath("/painel", "layout");
}
