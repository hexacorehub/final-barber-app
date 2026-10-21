import "server-only";
import { getStore } from "./data/store";
import { demoAccessConfigured } from "./demo-access";

/** Test data is on screen in the built-in demo data and in demo environments (demo access code set). */
export function showsTestData(): boolean {
  return getStore().mode === "demo" || demoAccessConfigured();
}
