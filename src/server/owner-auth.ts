import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

/**
 * Minimal gate for the owner dashboard until real accounts exist: a passcode in
 * PAINEL_PASSCODE. Without it the dashboard is open and shows a warning.
 */
const COOKIE = "painel_session";

const digest = (passcode: string) => createHash("sha256").update(`final-barber:${passcode}`).digest("hex");

export function passcodeConfigured(): boolean {
  return Boolean(process.env.PAINEL_PASSCODE);
}

export async function hasOwnerAccess(): Promise<boolean> {
  const passcode = process.env.PAINEL_PASSCODE;
  if (!passcode) return true;
  const value = (await cookies()).get(COOKIE)?.value;
  if (!value) return false;
  const a = Buffer.from(value);
  const b = Buffer.from(digest(passcode));
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function grantOwnerAccess(attempt: string): Promise<boolean> {
  const passcode = process.env.PAINEL_PASSCODE;
  if (!passcode) return true;
  const a = Buffer.from(digest(attempt));
  const b = Buffer.from(digest(passcode));
  if (!timingSafeEqual(a, b)) return false;
  (await cookies()).set(COOKIE, digest(passcode), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/painel", maxAge: 60 * 60 * 24 * 30 });
  return true;
}

export async function revokeOwnerAccess(): Promise<void> {
  (await cookies()).delete({ name: COOKIE, path: "/painel" });
}
