import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { Grant, Permission, Role, StaffMember } from "@/domain/access";
import { getStore } from "./data/store";
import { createSupabaseAdmin } from "./data/supabase-store";
import { demoAccessConfigured, hasDemoAccess } from "./demo-access";
import { hasOwnerAccess } from "./owner-auth";

/**
 * The team behind the dashboard. The owner enters with the dashboard passcode (or the demo
 * access) and manages everyone else. With STAFF_LOGIN=on, team members sign in with e-mail and
 * password; in the demo, "Ver como" switches between sample people to show what each sees.
 */

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export const OWNER: StaffMember = { id: "owner", name: "Dono", email: "", role: "owner", unitIds: [], barberId: null, overrides: {}, active: true };
export const VIEW_AS_COOKIE = "painel_ver_como";
const SESSION_COOKIE = "staff_session";

export function staffLoginEnabled(): boolean {
  return process.env.STAFF_LOGIN === "on";
}

const DEMO_STAFF: StaffMember[] = [
  { id: "staff-juliana", name: "Juliana (recepção)", email: "juliana@exemplo.com", role: "reception", unitIds: ["unit-chacara"], barberId: null, overrides: {}, active: true },
  { id: "staff-markos", name: "Markos (barbeiro)", email: "markos@exemplo.com", role: "barber", unitIds: ["unit-chacara"], barberId: "barber-markos", overrides: {}, active: true },
  { id: "staff-gerente", name: "Paula (gerente)", email: "paula@exemplo.com", role: "manager", unitIds: ["unit-guarapiranga"], barberId: null, overrides: {}, active: true },
];

// Demo memory: changes made in the demo live while the server process lives.
const demo = { staff: DEMO_STAFF.map((x) => ({ ...x })), passwords: new Map<string, string>(), audit: [] as AuditEntry[] };

export interface AuditEntry {
  id: string;
  at: string;
  actor: string;
  target: string;
  change: string;
}

const isDemo = () => getStore().mode === "demo";

type Row = Record<string, unknown>;
const fromRow = (r: Row): StaffMember => ({
  id: String(r.id),
  name: String(r.name),
  email: String(r.email),
  role: r.role as Role,
  unitIds: (r.unit_ids as string[]) ?? [],
  barberId: (r.barber_id as string | null) ?? null,
  overrides: (r.overrides as Partial<Record<Permission, Grant>>) ?? {},
  active: Boolean(r.active),
});

export async function listStaff(): Promise<StaffMember[]> {
  if (isDemo()) return demo.staff;
  const { data, error } = await createSupabaseAdmin().from("staff").select("id,name,email,role,unit_ids,barber_id,overrides,active").order("name");
  if (error) return [];
  return (data ?? []).map(fromRow);
}

async function hashPassword(pw: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(pw, salt, 32);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

async function verifyPassword(pw: string, stored: string): Promise<boolean> {
  const [, saltHex, keyHex] = stored.split("$");
  if (!saltHex || !keyHex) return false;
  const key = await scrypt(pw, Buffer.from(saltHex, "hex"), 32);
  const want = Buffer.from(keyHex, "hex");
  return key.length === want.length && timingSafeEqual(key, want);
}

export async function audit(actor: StaffMember, target: StaffMember, change: string): Promise<void> {
  const entry: AuditEntry = { id: `aud-${randomBytes(6).toString("hex")}`, at: new Date().toISOString(), actor: actor.name, target: target.name, change };
  if (isDemo()) {
    demo.audit.unshift(entry);
    return;
  }
  await createSupabaseAdmin().from("staff_audit").insert({ id: entry.id, created_at: entry.at, actor: entry.actor, target: entry.target, change: entry.change });
}

export async function listAudit(): Promise<AuditEntry[]> {
  if (isDemo()) return demo.audit.slice(0, 30);
  const { data } = await createSupabaseAdmin().from("staff_audit").select("*").order("created_at", { ascending: false }).limit(30);
  return (data ?? []).map((r) => ({ id: String(r.id), at: String(r.created_at), actor: String(r.actor), target: String(r.target), change: String(r.change) }));
}

export async function saveStaff(m: StaffMember): Promise<void> {
  if (isDemo()) {
    const i = demo.staff.findIndex((x) => x.id === m.id);
    if (i >= 0) demo.staff[i] = m;
    else demo.staff.push(m);
    return;
  }
  const { error } = await createSupabaseAdmin()
    .from("staff")
    .upsert({ id: m.id, name: m.name, email: m.email.toLowerCase(), role: m.role, unit_ids: m.unitIds, barber_id: m.barberId, overrides: m.overrides, active: m.active });
  if (error) throw new Error(error.message);
}

/** Creates a person with a one-time password the owner hands over (they change it later). */
export async function createStaff(input: Omit<StaffMember, "id" | "overrides" | "active">): Promise<{ member: StaffMember; tempPassword: string }> {
  const member: StaffMember = { ...input, id: `staff-${randomBytes(6).toString("hex")}`, overrides: {}, active: true };
  const tempPassword = randomBytes(6).toString("base64url");
  await saveStaff(member);
  const hash = await hashPassword(tempPassword);
  if (isDemo()) demo.passwords.set(member.id, hash);
  else await createSupabaseAdmin().from("staff").update({ password_hash: hash }).eq("id", member.id);
  return { member, tempPassword };
}

export async function signInStaff(email: string, password: string): Promise<boolean> {
  if (!staffLoginEnabled() || isDemo()) return false;
  const db = createSupabaseAdmin();
  const { data } = await db.from("staff").select("id,active,password_hash").eq("email", email.trim().toLowerCase()).maybeSingle();
  if (!data?.active || !data.password_hash || !(await verifyPassword(password, String(data.password_hash)))) return false;
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + 30 * 86_400_000);
  await db.from("staff_sessions").insert({ token_hash: createHash("sha256").update(token).digest("hex"), staff_id: data.id, expires_at: expires.toISOString() });
  (await cookies()).set(SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", expires });
  return true;
}

export async function signOutStaff(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token && !isDemo()) await createSupabaseAdmin().from("staff_sessions").delete().eq("token_hash", createHash("sha256").update(token).digest("hex"));
  jar.delete({ name: SESSION_COOKIE, path: "/" });
}

/** Who is using the dashboard now (null = nobody signed in). */
export const currentStaff = cache(async (): Promise<StaffMember | null> => {
  const jar = await cookies();
  if (staffLoginEnabled() && !isDemo()) {
    const token = jar.get(SESSION_COOKIE)?.value;
    if (token) {
      const db = createSupabaseAdmin();
      const { data } = await db.from("staff_sessions").select("staff_id,expires_at").eq("token_hash", createHash("sha256").update(token).digest("hex")).maybeSingle();
      if (data && String(data.expires_at) > new Date().toISOString()) {
        const { data: row } = await db.from("staff").select("id,name,email,role,unit_ids,barber_id,overrides,active").eq("id", data.staff_id).maybeSingle();
        if (row && row.active) return fromRow(row);
      }
    }
  }
  if (!(await hasOwnerAccess())) return null;
  // Demo only: "Ver como" shows the dashboard as a sample team member.
  const viewAs = jar.get(VIEW_AS_COOKIE)?.value;
  if (viewAs && (isDemo() || (demoAccessConfigured() && (await hasDemoAccess())))) {
    const m = (await listStaff()).find((x) => x.id === viewAs);
    if (m) return m;
  }
  return OWNER;
});

export function canViewAs(): boolean {
  return isDemo() || demoAccessConfigured();
}
