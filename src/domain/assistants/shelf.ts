import type { Customer, Product, Snapshot } from "../types";
import { addDays, dayKey, daysBetween } from "../time";

/**
 * The shop window assistant: when each product will run out at the current pace, who usually
 * buys it, which product a customer probably needs again, and what to suggest to them.
 */

/** Days a product usually lasts at home, by category, when there is no repeat purchase to learn from. */
const DEFAULT_LIFE_DAYS: Record<Product["category"], number> = { hair: 45, beard: 40, skin: 50, accessory: 180 };

export interface StockForecast {
  product: Product;
  /** Units a day over the last 30 days. */
  perDay: number;
  /** Days until the stock runs out at that pace; null when it does not sell. */
  daysLeft: number | null;
  buyers: { customer: Customer; units: number }[];
}

export function stockForecast(s: Snapshot): StockForecast[] {
  const today = dayKey(s.now);
  const from = addDays(today, -29);
  const customers = new Map(s.customers.map((c) => [c.id, c]));
  return s.products
    .filter((p) => p.active)
    .map((product) => {
      const sales = s.productSales.filter((x) => x.productId === product.id);
      const recent = sales.filter((x) => dayKey(x.soldAt) >= from && dayKey(x.soldAt) <= today);
      const perDay = recent.reduce((t, x) => t + x.quantity, 0) / 30;
      const byCustomer = new Map<string, number>();
      for (const x of sales) if (x.customerId) byCustomer.set(x.customerId, (byCustomer.get(x.customerId) ?? 0) + x.quantity);
      const buyers = [...byCustomer.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([id, units]) => ({ customer: customers.get(id)!, units }))
        .filter((x) => x.customer);
      return { product, perDay, daysLeft: perDay > 0 ? Math.floor(product.stock / perDay) : null, buyers };
    })
    .sort((a, b) => (a.daysLeft ?? 9999) - (b.daysLeft ?? 9999));
}

/** How long this product lasts for people who buy it again (median days between purchases). */
export function productLife(s: Snapshot, productId: string): number {
  const product = s.products.find((p) => p.id === productId);
  const byCustomer = new Map<string, string[]>();
  for (const x of s.productSales) {
    if (x.productId !== productId || !x.customerId) continue;
    (byCustomer.get(x.customerId) ?? byCustomer.set(x.customerId, []).get(x.customerId)!).push(dayKey(x.soldAt));
  }
  const gaps: number[] = [];
  for (const days of byCustomer.values()) {
    days.sort();
    for (let i = 1; i < days.length; i++) gaps.push(daysBetween(days[i - 1], days[i]));
  }
  if (gaps.length < 3) return DEFAULT_LIFE_DAYS[product?.category ?? "hair"];
  gaps.sort((a, b) => a - b);
  return gaps[Math.floor(gaps.length / 2)];
}

export interface Refill {
  product: Product;
  boughtOn: string;
  daysAgo: number;
  lifeDays: number;
}

/** Products the customer bought that are probably running out (within a week of their usual life). */
export function refillsFor(s: Snapshot, customerId: string): Refill[] {
  const today = dayKey(s.now);
  const last = new Map<string, string>();
  for (const x of s.productSales) {
    if (x.customerId !== customerId) continue;
    const d = dayKey(x.soldAt);
    if ((last.get(x.productId) ?? "") < d) last.set(x.productId, d);
  }
  const out: Refill[] = [];
  for (const [productId, boughtOn] of last) {
    const product = s.products.find((p) => p.id === productId && p.active);
    if (!product) continue;
    const lifeDays = productLife(s, productId);
    const daysAgo = daysBetween(boughtOn, today);
    if (daysAgo >= lifeDays - 7 && daysAgo <= lifeDays * 2) out.push({ product, boughtOn, daysAgo, lifeDays });
  }
  return out.sort((a, b) => b.daysAgo / b.lifeDays - a.daysAgo / a.lifeDays);
}

export interface Recommendation {
  product: Product;
  reason: string;
}

/**
 * What to suggest to a customer: products for what they do (beard → beard products), that
 * people with the same habits buy, and that they have not bought yet.
 */
export function recommendationsFor(s: Snapshot, customerId: string, max = 3): Recommendation[] {
  const services = new Map(s.services.map((x) => [x.id, x]));
  const mine = s.appointments.filter((a) => a.customerId === customerId && a.status === "completed");
  const doesBeard = mine.some((a) => a.serviceIds.some((id) => services.get(id)?.category === "beard"));
  const doesHair = mine.some((a) => a.serviceIds.some((id) => services.get(id)?.category === "hair"));
  const bought = new Set(s.productSales.filter((x) => x.customerId === customerId).map((x) => x.productId));
  const popularity = new Map<string, number>();
  for (const x of s.productSales) popularity.set(x.productId, (popularity.get(x.productId) ?? 0) + x.quantity);
  return s.products
    .filter((p) => p.active && p.stock > 0 && !bought.has(p.id))
    .filter((p) => (p.category === "beard" ? doesBeard : p.category === "hair" ? doesHair : true))
    .sort((a, b) => Number(b.category === "beard" && doesBeard) - Number(a.category === "beard" && doesBeard) || (popularity.get(b.id) ?? 0) - (popularity.get(a.id) ?? 0))
    .slice(0, max)
    .map((product) => ({
      product,
      reason: product.category === "beard" ? "Para quem faz a barba aqui" : product.category === "hair" ? "Mantém o corte em casa" : "Dos mais vendidos da casa",
    }));
}
