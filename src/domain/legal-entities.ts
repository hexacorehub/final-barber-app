import type { Snapshot, Unit } from "./types";
import { cnpjRoot, formatCnpj } from "./documents";

/**
 * Which company each unit belongs to. Units with the same CNPJ root are branches of one
 * company (one Final Finance company space); different roots are different companies. A unit
 * without a CNPJ is grouped under the shop until the owner fills it in.
 */
export interface LegalEntity {
  /** CNPJ root, or "sem-cnpj". */
  key: string;
  legalName: string;
  /** Full CNPJ of each unit (branches). */
  cnpjs: string[];
  units: Unit[];
  /** More than one unit under the same company. */
  branches: boolean;
}

export function legalEntities(s: Pick<Snapshot, "units" | "shop">): LegalEntity[] {
  const out = new Map<string, LegalEntity>();
  for (const u of s.units) {
    const key = u.cnpj ? cnpjRoot(u.cnpj) : "sem-cnpj";
    const e = out.get(key) ?? { key, legalName: u.legalName ?? s.shop.name, cnpjs: [], units: [], branches: false };
    e.units.push(u);
    if (u.cnpj) e.cnpjs.push(formatCnpj(u.cnpj));
    e.branches = e.units.length > 1;
    out.set(key, e);
  }
  return [...out.values()];
}

export function entityOf(s: Pick<Snapshot, "units" | "shop">, unitId: string): LegalEntity | null {
  return legalEntities(s).find((e) => e.units.some((u) => u.id === unitId)) ?? null;
}
