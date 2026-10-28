import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("login rate limit", () => {
  it("blocks a key after the maximum failures and frees it after the window", async () => {
    const { isBlocked, recordFailure, clearFailures, LOGIN_LIMIT } = await import("@/server/rate-limit");
    const t0 = 1_000_000;
    for (let i = 0; i < LOGIN_LIMIT.max; i++) {
      expect(isBlocked("k", t0)).toBe(false);
      recordFailure("k", t0);
    }
    expect(isBlocked("k", t0 + 1)).toBe(true);
    expect(isBlocked("other", t0 + 1)).toBe(false);
    expect(isBlocked("k", t0 + LOGIN_LIMIT.windowMs + 1)).toBe(false);
    recordFailure("k", t0);
    clearFailures("k");
    expect(isBlocked("k", t0)).toBe(false);
  });
});
