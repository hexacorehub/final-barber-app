import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }) }));

describe("demo personas", () => {
  it("cover manager, reception and barber, tied to units and barbers that exist", async () => {
    const { DEMO_STAFF } = await import("@/server/staff");
    const { BARBERS, UNITS } = await import("@/server/data/catalog");
    expect(new Set(DEMO_STAFF.map((x) => x.role))).toEqual(new Set(["manager", "reception", "barber"]));
    for (const m of DEMO_STAFF) {
      for (const u of m.unitIds) expect(UNITS.some((x) => x.id === u)).toBe(true);
      if (m.barberId) expect(BARBERS.some((b) => b.id === m.barberId && b.active)).toBe(true);
    }
  });
});
