import type { Plan, Service } from "./types";

/** Split of a visit's price into what the club covers and what is paid at the shop. */
export function priceFor(serviceIds: string[], services: Service[], plan: Plan | null): { chargedCents: number; coveredCents: number } {
  let chargedCents = 0;
  let coveredCents = 0;
  for (const id of serviceIds) {
    const svc = services.find((x) => x.id === id);
    if (!svc) continue;
    if (plan && svc.coverage && plan.covers.includes(svc.coverage)) coveredCents += svc.priceCents;
    else chargedCents += svc.priceCents;
  }
  return { chargedCents, coveredCents };
}
