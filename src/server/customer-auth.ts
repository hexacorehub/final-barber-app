import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { checkSignup, loginKind, type SignupInput } from "@/domain/signup";
import { digits } from "@/domain/documents";
import { getStore, loadFreshSnapshot } from "./data/store";
import { createSupabaseAdmin } from "./data/supabase-store";

/**
 * Customer sign-in with CPF or e-mail and a password. Off unless CUSTOMER_LOGIN=on: the demo
 * keeps opening as the demo customer. With the demo store (no Supabase) the credentials live in
 * memory, which is enough to try the flow locally.
 */
const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;
const COOKIE = "customer_session";
const memory = { creds: new Map<string, string>(), sessions: new Map<string, { customerId: string; expires: number }>() };
const isDemo = () => getStore().mode === "demo";

export function customerLoginEnabled(): boolean {
  return process.env.CUSTOMER_LOGIN === "on";
}

async function hash(pw: string): Promise<string> {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString("hex")}$${(await scrypt(pw, salt, 32)).toString("hex")}`;
}

async function verify(pw: string, stored: string): Promise<boolean> {
  const [, salt, key] = stored.split("$");
  if (!salt || !key) return false;
  const got = await scrypt(pw, Buffer.from(salt, "hex"), 32);
  const want = Buffer.from(key, "hex");
  return got.length === want.length && timingSafeEqual(got, want);
}

const tokenHash = (t: string) => createHash("sha256").update(t).digest("hex");

async function startSession(customerId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + 60 * 86_400_000);
  if (isDemo()) memory.sessions.set(tokenHash(token), { customerId, expires: expires.getTime() });
  else await createSupabaseAdmin().from("customer_sessions").insert({ token_hash: tokenHash(token), customer_id: customerId, expires_at: expires.toISOString() });
  (await cookies()).set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", expires });
}

export async function signUpCustomer(input: SignupInput): Promise<{ ok: true } | { ok: false; field: string; error: string }> {
  if (!customerLoginEnabled()) return { ok: false, field: "name", error: "Cadastro desligado nesta versão." };
  const s = await loadFreshSnapshot();
  const check = checkSignup(input, s.customers);
  if (!check.ok) return check;
  let customer;
  try {
    customer = await getStore().createCustomer({ name: input.name.trim().replace(/\s+/g, " "), phone: input.phone.trim(), holderId: null, relationship: null, minor: false, cpf: check.cpf, email: check.email });
  } catch {
    // The unique index caught a CPF or e-mail registered at the same time.
    return { ok: false, field: "cpf", error: "Esse CPF ou e-mail já tem conta." };
  }
  const h = await hash(input.password);
  if (isDemo()) memory.creds.set(customer.id, h);
  else await createSupabaseAdmin().from("customer_credentials").insert({ customer_id: customer.id, password_hash: h });
  await startSession(customer.id);
  return { ok: true };
}

export async function signInCustomer(identifier: string, password: string): Promise<boolean> {
  if (!customerLoginEnabled()) return false;
  const who = loginKind(identifier);
  if (!who) return false;
  const s = await loadFreshSnapshot();
  const c = s.customers.find((x) => !x.holderId && (who.kind === "cpf" ? x.cpf && digits(x.cpf) === digits(who.value) : x.email?.toLowerCase() === who.value));
  if (!c) return false;
  let stored: string | undefined;
  if (isDemo()) stored = memory.creds.get(c.id);
  else stored = (await createSupabaseAdmin().from("customer_credentials").select("password_hash").eq("customer_id", c.id).maybeSingle()).data?.password_hash as string | undefined;
  if (!stored || !(await verify(password, stored))) return false;
  await startSession(c.id);
  return true;
}

export async function signOutCustomer(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) {
    if (isDemo()) memory.sessions.delete(tokenHash(token));
    else await createSupabaseAdmin().from("customer_sessions").delete().eq("token_hash", tokenHash(token));
  }
  jar.delete({ name: COOKIE, path: "/" });
}

/** The signed-in customer, or null. */
export const sessionCustomerId = cache(async (): Promise<string | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  if (isDemo()) {
    const x = memory.sessions.get(tokenHash(token));
    return x && x.expires > Date.now() ? x.customerId : null;
  }
  const { data } = await createSupabaseAdmin().from("customer_sessions").select("customer_id,expires_at").eq("token_hash", tokenHash(token)).maybeSingle();
  return data && String(data.expires_at) > new Date().toISOString() ? String(data.customer_id) : null;
});
