"use client";

import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { formatMoney } from "@/domain/money";
import type { Product, ProductCategory } from "@/domain/types";
import { Badge, Placeholder, buttonStyles, cn } from "@/components/ui";
import { reserveProduct } from "./actions";

const FILTERS: { id: ProductCategory | "all"; label: string }[] = [
  { id: "all", label: "Todos" },
  { id: "hair", label: "Cabelo" },
  { id: "beard", label: "Barba" },
  { id: "skin", label: "Pele" },
  { id: "accessory", label: "Acessórios" },
];

export function Showcase({ products, bestSellers }: { products: Product[]; bestSellers: string[] }) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [reserved, setReserved] = useState<string[]>([]);
  const [error, setError] = useState<{ id: string; text: string } | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, start] = useTransition();

  const visible = products.filter((p) => filter === "all" || p.category === filter);
  const reserve = (id: string) => {
    setPendingId(id);
    start(async () => {
      const res = await reserveProduct(id);
      setPendingId(null);
      if (res.ok) setReserved((r) => [...r, id]);
      else setError({ id, text: res.error ?? "Não foi possível reservar." });
    });
  };

  return (
    <>
      <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5" role="group" aria-label="Filtrar por categoria">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            aria-pressed={filter === f.id}
            onClick={() => setFilter(f.id)}
            className={cn("h-10 shrink-0 rounded-full border-[1.5px] border-ink px-4 text-sm font-semibold", filter === f.id ? "bg-ink text-white" : "bg-white")}
          >
            {f.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {visible.map((p) => {
          const isReserved = reserved.includes(p.id);
          const soldOut = p.stock <= 0;
          return (
            <article key={p.id} id={p.id} className="flex scroll-mt-20 flex-col gap-2 rounded-2xl border border-line p-3">
              <div className="relative">
                <Placeholder label="Foto do produto" className="h-32 rounded-xl" />
                <div className="absolute top-2 left-2 flex flex-col items-start gap-1">
                  {bestSellers.includes(p.id) ? <Badge tone="dark">Mais vendido</Badge> : null}
                  {!soldOut && p.stock <= p.minStock ? <Badge tone="warn">Últimas unidades</Badge> : null}
                </div>
              </div>
              <h2 className="text-sm leading-snug font-semibold">{p.name}</h2>
              <p className="line-clamp-2 text-xs text-muted">{p.description}</p>
              <p className="mt-auto font-display text-lg tracking-normal">{formatMoney(p.priceCents)}</p>
              {isReserved ? (
                <p className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-ok-bg text-[13px] font-semibold text-ok">
                  <Check size={16} aria-hidden="true" /> Reservado
                </p>
              ) : (
                <button type="button" onClick={() => reserve(p.id)} disabled={soldOut || pendingId === p.id} className={cn(buttonStyles.secondary, "min-h-11 px-2 text-[13px]")}>
                  {soldOut ? "Esgotado" : pendingId === p.id ? "Reservando…" : "Reservar"}
                </button>
              )}
              {error?.id === p.id ? (
                <p role="alert" className="text-xs text-bad">
                  {error.text}
                </p>
              ) : null}
            </article>
          );
        })}
      </div>
      {reserved.length ? <p className="rounded-xl bg-chip p-4 text-sm text-ink-soft">Separamos para você. É só retirar e pagar na sua próxima visita.</p> : null}
    </>
  );
}
