import type { Snapshot } from "./types";

/**
 * The referral program's rules, as parameters the owner can change (stored in
 * shop_settings.referral_rules; these are the defaults).
 *
 * - Each friend who subscribes with your invite earns one credit worth `discountPct` of one
 *   monthly fee of the plan that receives the discount.
 * - A credit is born when the friend's first monthly fee is paid (the fee charged when the
 *   plan starts). If that first charge failed, it waits.
 * - At most `perCharge` credits are used on each monthly fee: the month's discount never goes
 *   above discountPct × perCharge of the fee.
 * - At most `maxQueued` credits wait in line; a friend who joins while the line is full still
 *   joins, but earns no new credit.
 * - A credit expires `expiryMonths` after it is born.
 * - Only account holders refer and receive (whoever pays). A credit goes to the holder's own
 *   plan; if they only pay for people in their account, to the most expensive of those plans.
 *   Never to every plan of the account.
 */
export interface ReferralRules {
  discountPct: number;
  perCharge: number;
  maxQueued: number;
  expiryMonths: number;
}

export const DEFAULT_REFERRAL_RULES: ReferralRules = { discountPct: 0.5, perCharge: 1, maxQueued: 6, expiryMonths: 12 };

export function referralRules(s: Pick<Snapshot, "shop">): ReferralRules {
  return { ...DEFAULT_REFERRAL_RULES, ...(s.shop.referralRules ?? {}) };
}

export type CreditStatus = "awaiting_payment" | "queued" | "scheduled" | "applied" | "expired" | "over_limit" | "no_plan" | "friend_left";

export const CREDIT_LABEL: Record<CreditStatus, string> = {
  awaiting_payment: "Aguardando a 1ª mensalidade do amigo",
  queued: "Na fila",
  scheduled: "Na próxima mensalidade",
  applied: "Aplicado",
  expired: "Venceu",
  over_limit: "Fila cheia: não gerou desconto",
  no_plan: "Esperando você ter um plano",
  friend_left: "O amigo cancelou antes de pagar",
};

/** Plain-language rule, the same on /indique and in the club terms. */
export function referralRulesText(r: ReferralRules): string[] {
  const pct = Math.round(r.discountPct * 100);
  return [
    `Cada amigo que assina com o seu convite vale ${pct}% de desconto em uma mensalidade sua.`,
    "O desconto nasce quando a primeira mensalidade do amigo é paga.",
    r.perCharge === 1 ? `No máximo um desconto por mês: a mensalidade nunca fica mais de ${pct}% mais barata.` : `No máximo ${r.perCharge} descontos por mês.`,
    `Até ${r.maxQueued} descontos ficam guardados na fila; cada um vale por ${r.expiryMonths} meses.`,
    "Só o titular da conta indica e recebe. O desconto vai para o plano dele; se ele só paga planos de outras pessoas da conta, vai para o mais caro deles.",
    "Indicar alguém da própria conta não conta.",
  ];
}
