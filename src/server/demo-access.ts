import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Special demo access (DEMO_ACCESS_CODE): one code that opens the whole app — the customer
 * view and the owner dashboard — with a bar to switch between them. When the code is set,
 * nothing is reachable without it. Share it as a link: /acesso/entrar?codigo=<code>.
 */
const COOKIE = "demo_access";
const MAX_AGE = 60 * 60 * 24 * 30;

const digest = (code: string) => createHash("sha256").update(`final-barber-demo:${code}`).digest("hex");

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function demoAccessConfigured(): boolean {
  return Boolean(process.env.DEMO_ACCESS_CODE);
}

/** True when this browser entered the demo code. */
export async function hasDemoAccess(): Promise<boolean> {
  const code = process.env.DEMO_ACCESS_CODE;
  if (!code) return false;
  const value = (await cookies()).get(COOKIE)?.value;
  return Boolean(value && safeEqual(value, digest(code)));
}

/** The app is open when no demo code is set, or when this browser has it. */
export async function canSeeApp(): Promise<boolean> {
  return !demoAccessConfigured() || (await hasDemoAccess());
}

export async function grantDemoAccess(attempt: string): Promise<boolean> {
  const code = process.env.DEMO_ACCESS_CODE;
  if (!code || !safeEqual(digest(attempt.trim()), digest(code))) return false;
  (await cookies()).set(COOKIE, digest(code), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: MAX_AGE });
  return true;
}

export async function revokeDemoAccess(): Promise<void> {
  (await cookies()).delete({ name: COOKIE, path: "/" });
}
