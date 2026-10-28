import "server-only";
import { demoActionLog, type AssistantAction } from "@/domain/assistants/scoreboard";
import { addDays, dayKey } from "@/domain/time";
import type { Snapshot } from "@/domain/types";
import { getStore } from "@/server/data/store";
import { createSupabaseAdmin } from "@/server/data/supabase-store";

/**
 * Messages the owner opened from an assistant suggestion. In the demo they live in memory, on
 * top of a simulated history; with Supabase, in the assistant_actions table.
 */
const memory: AssistantAction[] = [];

export async function recordAction(kind: string, customerId: string): Promise<void> {
  const action: AssistantAction = { id: `act-${crypto.randomUUID()}`, kind, customerId, at: new Date().toISOString() };
  if (getStore().mode === "demo") {
    memory.push(action);
    return;
  }
  const { error } = await createSupabaseAdmin().from("assistant_actions").insert({ id: action.id, kind, customer_id: customerId, created_at: action.at });
  // The table is optional: without it the scoreboard simply has no history yet.
  if (error) console.warn(`assistant_actions: ${error.message}`);
}

export async function actionLog(s: Snapshot): Promise<{ log: AssistantAction[]; simulated: boolean }> {
  if (getStore().mode === "demo") return { log: [...demoActionLog(s), ...memory], simulated: true };
  const since = addDays(dayKey(s.now), -60);
  const { data, error } = await createSupabaseAdmin().from("assistant_actions").select("*").gte("created_at", `${since}T00:00:00Z`).limit(5000);
  if (error) return { log: [], simulated: false };
  return {
    log: (data ?? []).map((r) => ({ id: String(r.id), kind: String(r.kind), customerId: String(r.customer_id), at: new Date(String(r.created_at)).toISOString() })),
    simulated: false,
  };
}
