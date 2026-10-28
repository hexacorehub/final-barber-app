import "server-only";

/**
 * Brakes on password guessing: after `max` failed attempts for the same key (an e-mail, a CPF
 * or the passcode form) inside `windowMs`, further attempts are refused until the window ends.
 * Kept in memory, so it is per server instance — enough to stop a script hammering one
 * account; a shared store (Supabase) can replace it when the app runs on several instances.
 */
const attempts = new Map<string, { count: number; until: number }>();

export const LOGIN_LIMIT = { max: 8, windowMs: 15 * 60_000 };

export function isBlocked(key: string, now = Date.now()): boolean {
  const a = attempts.get(key);
  if (!a) return false;
  if (a.until <= now) {
    attempts.delete(key);
    return false;
  }
  return a.count >= LOGIN_LIMIT.max;
}

export function recordFailure(key: string, now = Date.now()): void {
  const a = attempts.get(key);
  if (!a || a.until <= now) attempts.set(key, { count: 1, until: now + LOGIN_LIMIT.windowMs });
  else a.count++;
}

export function clearFailures(key: string): void {
  attempts.delete(key);
}

export const BLOCKED_MESSAGE = "Muitas tentativas. Espere 15 minutos e tente de novo.";
