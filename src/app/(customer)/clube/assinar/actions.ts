"use server";

import { revalidatePath } from "next/cache";
import { checkPlanRequest, household } from "@/domain/household";
import { getStore, loadSnapshot } from "@/server/data/store";
import { canSeeApp } from "@/server/demo-access";
import { currentCustomerId } from "@/server/session";

export type PlanRequestResult = { ok: true; kind: "new" | "upgrade" } | { ok: false; error: string };

/**
 * Records the request for a plan, for the holder or someone they manage. Payment is not
 * connected in the MVP: the team confirms on WhatsApp and the dashboard lists the request.
 */
export async function requestPlan(planId: string, beneficiaryId: string, referralCode: string | null): Promise<PlanRequestResult> {
  if (!(await canSeeApp())) return { ok: false, error: "Acesso de demonstração expirado. Entre de novo." };
  const s = await loadSnapshot();
  const me = await currentCustomerId();
  const check = checkPlanRequest(s, me, beneficiaryId, planId);
  if (!check.ok) return check;

  const family = new Set(household(s, me).map((m) => m.customer.id));
  const referrer = referralCode ? s.customers.find((c) => c.referralCode === referralCode.toUpperCase() && !family.has(c.id)) : undefined;

  await getStore().createPlanLead({
    customerId: beneficiaryId,
    requestedById: me,
    planId,
    kind: check.kind,
    referrerCustomerId: check.kind === "new" ? (referrer?.id ?? null) : null,
  });
  revalidatePath("/", "layout");
  return { ok: true, kind: check.kind };
}
