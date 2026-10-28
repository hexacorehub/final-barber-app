import { describe, expect, it } from "vitest";
import { allowedUnits, can, checkAccessChange, covers, maskCpf, permissionsOf, type StaffMember } from "@/domain/access";
import { actionsFor, ownerDay } from "@/domain/assistants/owner-actions";
import { buildDemoSnapshot } from "@/server/data/demo-dataset";

const owner: StaffMember = { id: "owner", name: "Dono", email: "", role: "owner", unitIds: [], barberId: null, overrides: {}, active: true };
const reception: StaffMember = { id: "r", name: "Juliana", email: "j@x.com", role: "reception", unitIds: ["unit-chacara"], barberId: null, overrides: {}, active: true };
const barber: StaffMember = { id: "b", name: "Markos", email: "m@x.com", role: "barber", unitIds: ["unit-chacara"], barberId: "barber-markos", overrides: {}, active: true };

describe("least privilege", () => {
  it("reception books and sends reminders, but sees no money, CPF or marketing", () => {
    expect(can(reception, "book")).toBe("units");
    expect(can(reception, "messages_utility")).toBe("units");
    expect(can(reception, "revenue")).toBe(false);
    expect(can(reception, "finance")).toBe(false);
    expect(can(reception, "cpf")).toBe(false);
    expect(can(reception, "messages_marketing")).toBe(false);
  });

  it("a barber sees only what is his", () => {
    expect(can(barber, "revenue")).toBe("own");
    expect(covers(barber, "own", { barberId: "barber-markos" })).toBe(true);
    expect(covers(barber, "own", { barberId: "barber-bigode" })).toBe(false);
    expect(permissionsOf({ ...barber, barberId: null }).revenue).toBe(false);
  });

  it("the owner can turn extra permissions on, but never team or club rules", () => {
    const more = { ...reception, overrides: { messages_marketing: "units" as const, team: "all" as const } };
    expect(can(more, "messages_marketing")).toBe("units");
    expect(can(more, "team")).toBe(false);
    expect(checkAccessChange(owner, reception, { team: "all" }).ok).toBe(false);
    expect(checkAccessChange(reception, barber, {}).ok).toBe(false);
    expect(checkAccessChange(owner, reception, { cpf: "all" }).ok).toBe(true);
  });

  it("units and inactive people", () => {
    expect(allowedUnits(owner)).toBeNull();
    expect(allowedUnits(reception)).toEqual(["unit-chacara"]);
    expect(can({ ...reception, active: false }, "agenda")).toBe(false);
    expect(maskCpf("123.456.789-09")).toBe("***.456.789-**");
  });

  it("the assistant's suggestions follow the same access", () => {
    const s = buildDemoSnapshot(new Date("2026-10-27T15:00:00Z"));
    const all = ownerDay(s);
    const forReception = actionsFor(all, reception);
    expect(forReception.actions.every((a) => a.kind === "plan_request" || a.kind === "low_stock" || a.kind === "fill_gap")).toBe(true);
    expect(forReception.actions.filter((a) => a.kind === "fill_gap").every((a) => a.message === null)).toBe(true);
    const forBarber = actionsFor(all, barber);
    expect(forBarber.actions.every((a) => !a.barberId || a.barberId === "barber-markos")).toBe(true);
    expect(forBarber.actions.some((a) => a.kind === "card_declined")).toBe(false);
  });
});
