import type { Customer, Plan, Relationship, Snapshot, Subscription } from "./types";

/**
 * Accounts ("titular" + the people they manage). Each person has at most one plan in force;
 * one account can hold several plans, one per person. Only the holder adds people, books for
 * them and asks for their plans.
 */

export const RELATIONSHIP_LABEL: Record<Relationship, string> = {
  child: "Filho(a)",
  spouse: "Cônjuge",
  parent: "Pai ou mãe",
  parent_in_law: "Sogro(a)",
  sibling: "Irmão(ã)",
  other: "Outro",
};

export const RELATIONSHIPS = Object.keys(RELATIONSHIP_LABEL) as Relationship[];

export interface HouseholdMember {
  customer: Customer;
  isHolder: boolean;
  /** Plan in force (active, past due or paused). */
  subscription: Subscription | null;
  plan: Plan | null;
}

export function isHolder(c: Customer): boolean {
  return c.holderId === null;
}

/** The plan a person has now — one per person. */
export function currentSubscription(s: Snapshot, customerId: string): Subscription | null {
  return s.subscriptions.find((x) => x.customerId === customerId && x.status !== "canceled") ?? null;
}

/** Holder first, then the people they manage, in the order they were added. */
export function household(s: Snapshot, customerId: string): HouseholdMember[] {
  const me = s.customers.find((c) => c.id === customerId);
  if (!me) return [];
  const holderId = me.holderId ?? me.id;
  const plans = new Map(s.plans.map((p) => [p.id, p]));
  return s.customers
    .filter((c) => c.id === holderId || c.holderId === holderId)
    .sort((a, b) => (a.id === holderId ? -1 : b.id === holderId ? 1 : a.createdAt.localeCompare(b.createdAt)))
    .map((customer) => {
      const subscription = currentSubscription(s, customer.id);
      return { customer, isHolder: customer.id === holderId, subscription, plan: subscription ? (plans.get(subscription.planId) ?? null) : null };
    });
}

export type PlanRequestCheck = { ok: true; kind: "new" | "upgrade" } | { ok: false; error: string };

/** Whether `requesterId` may ask for `planId` for `beneficiaryId`. */
export function checkPlanRequest(s: Snapshot, requesterId: string, beneficiaryId: string, planId: string): PlanRequestCheck {
  const requester = s.customers.find((c) => c.id === requesterId);
  if (!requester) return { ok: false, error: "Conta não encontrada." };
  if (!isHolder(requester)) return { ok: false, error: "Só o titular da conta pode contratar planos." };
  const beneficiary = s.customers.find((c) => c.id === beneficiaryId);
  if (!beneficiary || (beneficiary.id !== requester.id && beneficiary.holderId !== requester.id)) {
    return { ok: false, error: "Essa pessoa não está na sua conta." };
  }
  if (!s.plans.some((p) => p.id === planId)) return { ok: false, error: "Plano não encontrado." };
  const pending = s.leads.some((l) => l.customerId === beneficiaryId && !s.subscriptions.some((x) => x.customerId === beneficiaryId && x.planId === l.planId && x.status !== "canceled"));
  const current = currentSubscription(s, beneficiaryId);
  if (current?.planId === planId) return { ok: false, error: `${firstName(beneficiary.name)} já tem esse plano.` };
  if (pending) return { ok: false, error: `Já existe um pedido de plano para ${firstName(beneficiary.name)}. A equipe confirma pelo WhatsApp.` };
  return { ok: true, kind: current ? "upgrade" : "new" };
}

export function checkAddMember(s: Snapshot, requesterId: string, name: string): { ok: true } | { ok: false; error: string } {
  const requester = s.customers.find((c) => c.id === requesterId);
  if (!requester || !isHolder(requester)) return { ok: false, error: "Só o titular da conta pode adicionar pessoas." };
  const clean = normalizeName(name);
  if (clean.length < 2) return { ok: false, error: "Digite o nome da pessoa." };
  const members = s.customers.filter((c) => c.holderId === requesterId || c.id === requesterId);
  if (members.some((c) => normalizeName(c.name) === clean)) return { ok: false, error: "Essa pessoa já está na sua conta." };
  if (members.length >= 8) return { ok: false, error: "Limite de 8 pessoas por conta." };
  return { ok: true };
}

/** "RAFAEL-7021": first name without accents + a short number. */
export function referralCodeFor(name: string, seed: number): string {
  const first = name
    .split(" ")[0]
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
  return `${first || "CLUBE"}-${String(Math.abs(seed) % 10000).padStart(4, "0")}`;
}

function firstName(name: string): string {
  return name.split(" ")[0];
}

function normalizeName(name: string): string {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}
