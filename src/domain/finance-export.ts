import type { Snapshot } from "./types";
import { addDays, dayKey } from "./time";
import { barberRevenue, clubCharges } from "./metrics";
import { cnpjRoot, digits, formatCnpj } from "./documents";
import { legalEntities } from "./legal-entities";
import { scopeToUnit } from "./units";

/**
 * What the Final Barber sends to Final Finance (contract version 1, docs/finance-contract.md).
 * Revenue goes per unit and per day; what is owed to the barbers goes per period, because the
 * club's share of each barber depends on the whole period. Everything is computed by the same
 * functions as the dashboard, so the totals match it.
 */

export const FINANCE_CONTRACT_VERSION = 1;

/** Final Finance category names (class "renda" / "empresa"). */
export const FINANCE_CATEGORY = {
  revenue: "Faturamento (vendas e serviços)",
  partners: "Prestadores de serviço - Empresa",
} as const;

export interface FinanceLine {
  /** Stable key: sending the same day again updates the entry instead of duplicating it. */
  externalId: string;
  kind: "income" | "expense";
  category: string;
  description: string;
  amountCents: number;
  /** Club: referral discounts already taken out of amountCents. */
  discountCents?: number;
  count?: number;
}

export interface FinanceDay {
  date: string;
  lines: FinanceLine[];
  incomeCents: number;
  /** Payment method is unknown until payments are integrated. */
  paymentMethod: null;
}

export interface PartnerShare {
  externalId: string;
  kind: "expense";
  category: string;
  description: string;
  from: string;
  to: string;
  payable: true;
  amountCents: number;
  byBarber: { id: string; name: string; serviceCents: number; productCents: number; amountCents: number }[];
}

export interface FinanceUnitExport {
  unit: { id: string; name: string; cnpj: string | null };
  days: FinanceDay[];
  partners: PartnerShare;
  incomeCents: number;
}

export interface FinanceCompanyExport {
  /** Full CNPJ of the head office (or the first unit), or null without one. */
  cnpj: string | null;
  cnpjRoot: string | null;
  legalName: string;
  units: FinanceUnitExport[];
  incomeCents: number;
}

export interface FinanceExport {
  version: number;
  source: "final-barber";
  generatedAt: string;
  from: string;
  to: string;
  companies: FinanceCompanyExport[];
}

export function financeExport(s: Snapshot, q: { from: string; to: string; cnpj?: string | null }): FinanceExport {
  const today = dayKey(s.now);
  const to = q.to > today ? today : q.to;
  const wanted = q.cnpj ? digits(q.cnpj) : null;
  const companies: FinanceCompanyExport[] = [];

  for (const entity of legalEntities(s)) {
    const root = entity.key === "sem-cnpj" ? null : entity.key;
    if (wanted && (!root || (wanted.length === 8 ? wanted !== root : cnpjRoot(wanted) !== root))) continue;
    const units: FinanceUnitExport[] = [];
    for (const unit of entity.units) {
      if (wanted && wanted.length === 14 && unit.cnpj && digits(unit.cnpj) !== wanted) continue;
      const scoped = scopeToUnit(s, unit.id);
      const days: FinanceDay[] = [];
      for (let d = q.from; d <= to; d = addDays(d, 1)) days.push(dayExport(scoped, unit.id, d));
      const barbers = barberRevenue(scoped, { from: q.from, to }, { includeInactive: true });
      const byBarber = barbers
        .map((b) => ({ id: b.barber.id, name: b.barber.name, serviceCents: b.serviceCommissionCents, productCents: b.productCommissionCents, amountCents: b.serviceCommissionCents + b.productCommissionCents }))
        .filter((b) => b.amountCents > 0);
      units.push({
        unit: { id: unit.id, name: unit.name, cnpj: unit.cnpj ? formatCnpj(unit.cnpj) : null },
        days: days.filter((d) => d.lines.length),
        partners: {
          externalId: `barber:${unit.id}:${q.from}:${to}:partners`,
          kind: "expense",
          category: FINANCE_CATEGORY.partners,
          description: `Repasse aos barbeiros · ${unit.name}`,
          from: q.from,
          to,
          payable: true,
          amountCents: byBarber.reduce((t, b) => t + b.amountCents, 0),
          byBarber,
        },
        incomeCents: days.reduce((t, d) => t + d.incomeCents, 0),
      });
    }
    if (!units.length) continue;
    companies.push({
      cnpj: entity.cnpjs[0] ?? null,
      cnpjRoot: root,
      legalName: entity.legalName,
      units,
      incomeCents: units.reduce((t, u) => t + u.incomeCents, 0),
    });
  }
  return { version: FINANCE_CONTRACT_VERSION, source: "final-barber", generatedAt: new Date(s.now).toISOString(), from: q.from, to, companies };
}

function dayExport(s: Snapshot, unitId: string, day: string): FinanceDay {
  const r = { from: day, to: day };
  const done = s.appointments.filter((a) => a.status === "completed" && dayKey(a.startsAt) === day && a.chargedCents > 0);
  const charges = clubCharges(s, r);
  const sales = s.productSales.filter((x) => dayKey(x.soldAt) === day);
  const id = (k: string) => `barber:${unitId}:${day}:${k}`;
  const lines: FinanceLine[] = [];
  const services = done.reduce((t, a) => t + a.chargedCents, 0);
  if (services) lines.push({ externalId: id("services"), kind: "income", category: FINANCE_CATEGORY.revenue, description: `Serviços avulsos · ${done.length} ${done.length === 1 ? "atendimento" : "atendimentos"}`, amountCents: services, count: done.length });
  const club = charges.reduce((t, c) => t + c.amountCents, 0);
  if (charges.length)
    lines.push({
      externalId: id("club"),
      kind: "income",
      category: FINANCE_CATEGORY.revenue,
      description: `Mister Club · ${charges.length} ${charges.length === 1 ? "mensalidade" : "mensalidades"}`,
      amountCents: club,
      discountCents: charges.reduce((t, c) => t + c.discountCents, 0),
      count: charges.length,
    });
  const products = sales.reduce((t, x) => t + x.quantity * x.unitPriceCents, 0);
  const items = sales.reduce((t, x) => t + x.quantity, 0);
  if (products) lines.push({ externalId: id("products"), kind: "income", category: FINANCE_CATEGORY.revenue, description: `Produtos · ${items} ${items === 1 ? "item" : "itens"}`, amountCents: products, count: items });
  return { date: day, lines, incomeCents: services + club + products, paymentMethod: null };
}
