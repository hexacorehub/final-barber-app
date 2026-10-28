"use server";

import { z } from "zod";
import { ask, type Answer } from "@/domain/assistants/ask";
import { loadSnapshot } from "@/server/data/store";
import { can } from "@/domain/access";
import { currentStaff } from "@/server/staff";
import { painelSnapshot } from "@/server/painel-scope";
import { recordAction } from "./log";

const Track = z.object({ kind: z.string().min(1).max(40), customerId: z.string().min(1).max(80) });

/** Called when the owner opens a message from a suggestion (for the scoreboard). */
export async function trackAssistantAction(raw: { kind: string; customerId: string }): Promise<void> {
  if (!(await currentStaff())) return;
  const input = Track.safeParse(raw);
  if (!input.success) return;
  await recordAction(input.data.kind, input.data.customerId);
}

export async function askAssistant(question: string): Promise<Answer | null> {
  const staff = await currentStaff();
  const revenue = can(staff, "revenue");
  if (revenue !== "all" && revenue !== "units") return null;
  const q = String(question ?? "").slice(0, 300);
  if (!q.trim()) return null;
  // Someone limited to some units asks about their units only.
  return ask(revenue === "all" ? await loadSnapshot() : await painelSnapshot(), q);
}
