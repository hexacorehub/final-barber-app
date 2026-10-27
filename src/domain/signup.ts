import type { Customer } from "./types";
import { digits, formatCpf, isValidCpf } from "./documents";

/**
 * Customer sign-up and sign-in rules. One CPF = one account: the CPF identifies the person, and
 * nobody can register it twice (a database index guarantees it too). People can sign in with the
 * CPF or the e-mail; both point to the same account. People managed by a holder (a son, a
 * father-in-law) may have a CPF, also unique, but do not sign in: the holder manages them.
 */

export interface SignupInput {
  name: string;
  cpf: string;
  email: string;
  phone: string;
  password: string;
}

export type SignupCheck = { ok: true; cpf: string; email: string } | { ok: false; field: keyof SignupInput; error: string };

export const MIN_PASSWORD = 8;

export function normalizeEmail(v: string): string {
  return v.trim().toLowerCase();
}

export function checkSignup(input: SignupInput, existing: Pick<Customer, "cpf" | "email">[]): SignupCheck {
  if (input.name.trim().replace(/\s+/g, " ").split(" ").length < 2) return { ok: false, field: "name", error: "Digite nome e sobrenome." };
  if (!isValidCpf(input.cpf)) return { ok: false, field: "cpf", error: "CPF inválido. Confira os números." };
  const cpf = formatCpf(input.cpf);
  if (existing.some((c) => c.cpf && digits(c.cpf) === digits(cpf))) return { ok: false, field: "cpf", error: "Esse CPF já tem conta. Entre com ele ou recupere o acesso na barbearia." };
  const email = normalizeEmail(input.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, field: "email", error: "E-mail inválido." };
  if (existing.some((c) => c.email && normalizeEmail(c.email) === email)) return { ok: false, field: "email", error: "Esse e-mail já está em outra conta." };
  if (digits(input.phone).length < 10) return { ok: false, field: "phone", error: "Digite o WhatsApp com DDD." };
  if (input.password.length < MIN_PASSWORD) return { ok: false, field: "password", error: `A senha precisa de pelo menos ${MIN_PASSWORD} caracteres.` };
  return { ok: true, cpf, email };
}

/** What the person typed to sign in: a CPF (11 valid digits) or an e-mail. */
export function loginKind(identifier: string): { kind: "cpf"; value: string } | { kind: "email"; value: string } | null {
  const d = digits(identifier);
  if (d.length === 11 && isValidCpf(d) && !identifier.includes("@")) return { kind: "cpf", value: formatCpf(d) };
  if (identifier.includes("@")) return { kind: "email", value: normalizeEmail(identifier) };
  return null;
}

/** A CPF for someone managed in the account: optional, but unique when given. */
export function checkMemberCpf(cpf: string | undefined, existing: Pick<Customer, "cpf">[]): { ok: true; cpf: string | null } | { ok: false; error: string } {
  if (!cpf || !digits(cpf)) return { ok: true, cpf: null };
  if (!isValidCpf(cpf)) return { ok: false, error: "CPF inválido." };
  if (existing.some((c) => c.cpf && digits(c.cpf) === digits(cpf))) return { ok: false, error: "Esse CPF já está cadastrado." };
  return { ok: true, cpf: formatCpf(cpf) };
}
