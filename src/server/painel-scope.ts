import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import type { Snapshot, Unit } from "@/domain/types";
import { scopeToUnit } from "@/domain/units";
import { loadSnapshot } from "./data/store";
import { allowedUnits } from "@/domain/access";
import { currentStaff } from "./staff";

/** The unit the owner is looking at in the dashboard ("todas" when none), kept in a cookie. */
export const UNIT_COOKIE = "painel_unidade";

export const painelUnit = cache(async (): Promise<Unit | null> => {
  const id = (await cookies()).get(UNIT_COOKIE)?.value;
  const units = (await loadSnapshot()).units;
  const staff = await currentStaff();
  const allowed = staff ? allowedUnits(staff) : null;
  // Someone who works at some units only never sees "todas": they land on one of theirs.
  if (allowed) return units.find((u) => u.id === id && allowed.includes(u.id)) ?? units.find((u) => allowed.includes(u.id)) ?? null;
  return units.find((u) => u.id === id) ?? null;
});

/** The dashboard's data, scoped to the chosen unit. */
export const painelSnapshot = cache(async (): Promise<Snapshot> => {
  const unit = await painelUnit();
  return scopeToUnit(await loadSnapshot(), unit?.id ?? null);
});
