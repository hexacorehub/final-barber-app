"use server";

import { revalidatePath } from "next/cache";
import { demoAccessConfigured } from "@/server/demo-access";
import { getStore } from "@/server/data/store";
import { hasOwnerAccess } from "@/server/owner-auth";

/** Rebuilds the simulated history with dates from today (demo environments only). */
export async function refreshDemoData(): Promise<void> {
  if (!demoAccessConfigured() || !(await hasOwnerAccess())) return;
  await getStore().reseedDemo?.();
  revalidatePath("/", "layout");
}
