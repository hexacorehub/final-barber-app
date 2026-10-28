import type { Metadata } from "next";
import { productStats } from "@/domain/metrics";
import { addDays, dayKey } from "@/domain/time";
import { loadSnapshot } from "@/server/data/store";
import { Showcase } from "./showcase";
import { recommendationsFor, refillsFor } from "@/domain/assistants/shelf";
import { currentCustomerId } from "@/server/session";

export const metadata: Metadata = { title: "Produtos" };

export default async function ProductsPage() {
  const s = await loadSnapshot();
  const today = dayKey(s.now);
  const ranked = productStats(s, { from: addDays(today, -60), to: today });
  const bestSellers = ranked.filter((x) => x.units > 0).slice(0, 3).map((x) => x.product.id);
  const meId = await currentCustomerId();
  const forYou = [
    ...refillsFor(s, meId).map((r) => ({ id: r.product.id, reason: `Você comprou há ${r.daysAgo} dias: deve estar acabando` })),
    ...recommendationsFor(s, meId).map((r) => ({ id: r.product.id, reason: r.reason })),
  ].filter((x, i, all) => all.findIndex((y) => y.id === x.id) === i);
  return (
    <div className="flex flex-col gap-5 px-5 pt-5 md:px-0 md:pt-8">
      <div>
        <h1 className="font-display text-[28px] font-semibold md:text-[36px]">Produtos</h1>
        <p className="text-sm text-muted">Os mesmos que usamos na cadeira. Reserve e retire na sua próxima visita.</p>
      </div>
      <Showcase products={s.products.filter((p) => p.active)} bestSellers={bestSellers} forYou={forYou} />
    </div>
  );
}
