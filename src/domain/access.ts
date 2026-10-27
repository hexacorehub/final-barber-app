/**
 * Who sees what in the dashboard, by least privilege. Each person of the team has a role that
 * gives the minimum to do their job, only in the units they work at; the owner turns extra
 * permissions on per person. Two things never leave the owner: the team and its access, and the
 * club and referral rules. The server checks these on every page and action, not just the menu.
 */

/** "all" = every unit; "units" = the person's units; "own" = only what is theirs (their agenda, their clients). */
export type Scope = "all" | "units" | "own";
export type Grant = Scope | false;

export type Permission =
  | "agenda"
  | "book"
  | "contacts"
  | "cpf"
  | "messages_utility"
  | "messages_marketing"
  | "candidates"
  | "requests"
  | "subscriptions"
  | "revenue"
  | "commissions"
  | "finance"
  | "products"
  | "products_manage"
  | "team"
  | "club_rules";

export type Role = "owner" | "manager" | "reception" | "barber";

export const PERMISSIONS: { key: Permission; label: string; detail: string; scoped: boolean }[] = [
  { key: "agenda", label: "Ver agenda", detail: "Horários marcados e livres", scoped: true },
  { key: "book", label: "Agendar, remarcar e cancelar", detail: "Para os clientes", scoped: true },
  { key: "contacts", label: "Ver WhatsApp dos clientes", detail: "Telefone e conversa", scoped: true },
  { key: "cpf", label: "Ver CPF completo", detail: "Sem isso, aparece mascarado", scoped: false },
  { key: "messages_utility", label: "Enviar lembretes e avisos", detail: "WhatsApp de utilidade", scoped: true },
  { key: "messages_marketing", label: "Enviar convites e reconquista", detail: "WhatsApp de marketing", scoped: true },
  { key: "candidates", label: "Candidatos ao clube", detail: "Quem pode assinar", scoped: true },
  { key: "requests", label: "Confirmar pedidos", detail: "Pedidos de plano e retirada de produto", scoped: true },
  { key: "subscriptions", label: "Assinaturas e cancelamentos", detail: "Rastreio, risco e reconquista", scoped: true },
  { key: "revenue", label: "Faturamento", detail: "Da barbearia, das unidades ou o próprio", scoped: true },
  { key: "commissions", label: "Comissões", detail: "De todos ou a própria", scoped: true },
  { key: "finance", label: "Financeiro e Final Finance", detail: "Fontes de receita e envio ao Finance", scoped: true },
  { key: "products", label: "Ver produtos e estoque", detail: "Vitrine e reservas", scoped: false },
  { key: "products_manage", label: "Registrar retirada de produtos", detail: "Baixa de reservas", scoped: false },
  { key: "team", label: "Equipe e acessos", detail: "Só o dono", scoped: false },
  { key: "club_rules", label: "Regras do clube e da indicação", detail: "Só o dono", scoped: false },
];

/** Never delegated: only the owner role has them. */
export const OWNER_ONLY: Permission[] = ["team", "club_rules"];

export const ROLE_LABEL: Record<Role, string> = { owner: "Dono", manager: "Gerente da unidade", reception: "Recepção", barber: "Barbeiro" };

const none = Object.fromEntries(PERMISSIONS.map((p) => [p.key, false])) as Record<Permission, Grant>;

export const ROLE_TEMPLATES: Record<Role, Record<Permission, Grant>> = {
  owner: Object.fromEntries(PERMISSIONS.map((p) => [p.key, "all"])) as Record<Permission, Grant>,
  manager: {
    ...none,
    agenda: "units",
    book: "units",
    contacts: "units",
    messages_utility: "units",
    messages_marketing: "units",
    candidates: "units",
    requests: "units",
    subscriptions: "units",
    revenue: "units",
    commissions: "units",
    products: "all",
    products_manage: "all",
  },
  reception: {
    ...none,
    agenda: "units",
    book: "units",
    contacts: "units",
    messages_utility: "units",
    requests: "units",
    products: "all",
    products_manage: "all",
  },
  barber: {
    ...none,
    agenda: "own",
    book: "own",
    contacts: "own",
    candidates: "own",
    revenue: "own",
    commissions: "own",
    products: "all",
  },
};

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: Role;
  /** Units the person works at (for "units" and "own" scopes). Empty = every unit (owner). */
  unitIds: string[];
  /** For barbers: the barber profile that is "theirs". */
  barberId: string | null;
  /** What the owner turned on or off on top of the role. */
  overrides: Partial<Record<Permission, Grant>>;
  active: boolean;
}

export function permissionsOf(m: StaffMember): Record<Permission, Grant> {
  const merged = { ...ROLE_TEMPLATES[m.role], ...m.overrides };
  if (m.role !== "owner") for (const k of OWNER_ONLY) merged[k] = false;
  // A barber's "own" has no meaning without a barber profile.
  if (!m.barberId) for (const k of Object.keys(merged) as Permission[]) if (merged[k] === "own") merged[k] = false;
  return merged;
}

export function can(m: StaffMember | null, p: Permission): Grant {
  if (!m || !m.active) return false;
  return permissionsOf(m)[p];
}

/** Units the person may look at in the dashboard (null = all). */
export function allowedUnits(m: StaffMember): string[] | null {
  if (m.role === "owner" || !m.unitIds.length) return null;
  return m.unitIds;
}

/** Whether `grant` covers a record of `unitId` / `barberId`. */
export function covers(m: StaffMember, grant: Grant, where: { unitId?: string | null; barberId?: string | null }): boolean {
  if (!grant) return false;
  if (grant === "all") return true;
  if (grant === "units") return !where.unitId || m.unitIds.length === 0 || m.unitIds.includes(where.unitId);
  return Boolean(m.barberId && where.barberId === m.barberId);
}

/** Changing access is checked again on the server: a non-owner can never change it, and nobody can grant owner-only permissions. */
export function checkAccessChange(actor: StaffMember | null, target: StaffMember, next: Partial<Record<Permission, Grant>>): { ok: true } | { ok: false; error: string } {
  if (!actor || can(actor, "team") !== "all") return { ok: false, error: "Só o dono muda acessos." };
  if (target.role === "owner") return { ok: false, error: "O acesso do dono não muda." };
  for (const k of OWNER_ONLY) if (next[k]) return { ok: false, error: "Equipe e regras do clube são só do dono." };
  return { ok: true };
}

/** "*** .456.789-**": what everyone without the CPF permission sees. */
export function maskCpf(cpf: string | null | undefined): string {
  const d = (cpf ?? "").replace(/\D/g, "");
  if (d.length !== 11) return "—";
  return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
}
