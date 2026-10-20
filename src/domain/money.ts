const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const brlRound = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const pct = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 0 });
const int = new Intl.NumberFormat("pt-BR");

/** R$ 149,99 */
export function formatMoney(cents: number): string {
  return brl.format(cents / 100).replace(/ /g, " ");
}

/** R$ 1.250 — for dashboards, where cents are noise. */
export function formatMoneyRound(cents: number): string {
  return brlRound.format(Math.round(cents / 100)).replace(/ /g, " ");
}

/** R$ 27,4 mil */
export function formatMoneyCompact(cents: number): string {
  const reais = cents / 100;
  if (Math.abs(reais) >= 1000) {
    return `R$ ${(reais / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1, minimumFractionDigits: reais >= 100_000 ? 0 : 1 })} mil`;
  }
  return formatMoneyRound(cents);
}

export function formatPercent(ratio: number): string {
  return pct.format(ratio);
}

export function formatInt(n: number): string {
  return int.format(n);
}
