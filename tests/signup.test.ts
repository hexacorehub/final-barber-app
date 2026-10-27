import { describe, expect, it } from "vitest";
import { formatCpf, isValidCpf } from "@/domain/documents";
import { checkMemberCpf, checkSignup, loginKind } from "@/domain/signup";

const ok = { name: "Ana Souza", cpf: "529.982.247-25", email: "Ana@Exemplo.com", phone: "(11) 91234-5678", password: "segredo123" };

describe("CPF", () => {
  it("validates check digits and formats", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("529.982.247-26")).toBe(false);
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(formatCpf("12345678909")).toBe("123.456.789-09");
  });
});

describe("sign-up", () => {
  it("accepts a valid person and normalizes CPF and e-mail", () => {
    expect(checkSignup(ok, [])).toEqual({ ok: true, cpf: "529.982.247-25", email: "ana@exemplo.com" });
  });

  it("allows only one account per CPF and per e-mail", () => {
    expect(checkSignup(ok, [{ cpf: "52998224725", email: null }])).toMatchObject({ ok: false, field: "cpf" });
    expect(checkSignup(ok, [{ cpf: null, email: "ana@exemplo.com" }])).toMatchObject({ ok: false, field: "email" });
  });

  it("checks name, CPF, e-mail, phone and password", () => {
    expect(checkSignup({ ...ok, name: "Ana" }, [])).toMatchObject({ field: "name" });
    expect(checkSignup({ ...ok, cpf: "123" }, [])).toMatchObject({ field: "cpf" });
    expect(checkSignup({ ...ok, email: "ana" }, [])).toMatchObject({ field: "email" });
    expect(checkSignup({ ...ok, phone: "123" }, [])).toMatchObject({ field: "phone" });
    expect(checkSignup({ ...ok, password: "curta" }, [])).toMatchObject({ field: "password" });
  });

  it("signs in with CPF or e-mail", () => {
    expect(loginKind("529.982.247-25")).toEqual({ kind: "cpf", value: "529.982.247-25" });
    expect(loginKind(" Ana@Exemplo.com ")).toEqual({ kind: "email", value: "ana@exemplo.com" });
    expect(loginKind("12345")).toBeNull();
  });

  it("a family member's CPF is optional but unique", () => {
    expect(checkMemberCpf(undefined, [])).toEqual({ ok: true, cpf: null });
    expect(checkMemberCpf("123.456.789-09", [{ cpf: "12345678909" }]).ok).toBe(false);
    expect(checkMemberCpf("123.456.789-09", [])).toEqual({ ok: true, cpf: "123.456.789-09" });
  });
});
