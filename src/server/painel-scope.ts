import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import type { Snapshot, Unit } from "@/domain/types";
import { scopeToUnit } from "@/domain/units";
import { loadSnapshot } from "./data/store";

/** The unit the owner is looking at in the dashboard ("todas" when none), kept in a cookie. */
export const UNIT_COOKIE = "painel_unidade";

export const painelUnit = cache(async (): Promise<Unit | null> => {
  const id = (await cookies()).get(UNIT_COOKIE)?.value;
  if (!id) return null;
  return (await loadSnapshot()).units.find((u) => u.id === id) ?? null;
});

/** The dashboard's data, scoped to the chosen unit. */
export const painelSnapshot = cache(async (): Promise<Snapshot> => {
  const unit = await painelUnit();
  return scopeToUnit(await loadSnapshot(), unit?.id ?? null);
});
