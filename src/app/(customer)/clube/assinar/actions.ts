"use server";

import { revalidatePath } from "next/cache";
import { getStore, loadSnapshot } from "@/server/data/store";
import { currentCustomerId } from "@/server/session";

/**
 * Records the wish to subscribe. Payment is not connected in the MVP: the team confirms
 * on WhatsApp and the dashboard lists the request under "Interessados pelo app".
 */
export async function requestPlan(planId: string): Promise<{ ok: boolean; error?: string }> {
  const s = await loadSnapshot();
  if (!s.plans.some((p) => p.id === planId)) return { ok: false, error: "Plano não encontrado." };
  await getStore().createPlanLead({ customerId: await currentCustomerId(), planId });
  revalidatePath("/painel", "layout");
  return { ok: true };
}
