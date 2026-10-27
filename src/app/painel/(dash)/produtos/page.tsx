import type { Metadata } from "next";
import Link from "next/link";
import { DataTable, Empty, PageHeader, Panel, parsePeriod } from "@/components/dashboard";
import { Photo } from "@/components/photo";
import { Badge, Stat } from "@/components/ui";
import { periodRange, productStats } from "@/domain/metrics";
import { formatInt, formatMoney, formatMoneyRound, formatPercent } from "@/domain/money";
import { dayKey, shortDate } from "@/domain/time";
import { loadSnapshot } from "@/server/data/store";
import { AssistantSays, AssistantTag } from "@/components/assistant";
import { stockForecast } from "@/domain/assistants/shelf";

export const metadata: Metadata = { title: "Produtos" };

const CATEGORY = { hair: "Cabelo", beard: "Barba", skin: "Pele", accessory: "Acessórios" } as const;

export default async function ProductsDashboardPage({ searchParams }: { searchParams: Promise<{ periodo?: string }> }) {
  const s = await loadSnapshot();
  const range = periodRange(parsePeriod((await searchParams).periodo), new Date(s.now));
  const stats = productStats(s, range);
  const revenue = stats.reduce((t, p) => t + p.revenueCents, 0);
  const margin = stats.reduce((t, p) => t + p.marginCents, 0);
  const units = stats.reduce((t, p) => t + p.units, 0);
  const low = stats.filter((p) => p.lowStock && p.product.active);
  const reservations = s.reservations.filter((r) => r.status === "reserved").sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const customers = new Map(s.customers.map((c) => [c.id, c]));
  const products = new Map(s.products.map((p) => [p.id, p]));
  const forecast = stockForecast(s);
  const forecastOf = new Map(forecast.map((f) => [f.product.id, f]));
  const soon = forecast.filter((f) => f.daysLeft !== null && f.daysLeft <= 21);

  return (
    <>
      <PageHeader title="Produtos" range={range} path="/painel/produtos">
        <p className="mt-1 text-sm text-muted">
          A vitrine que o cliente vê no app.{" "}
          <Link href="/produtos" className="font-semibold text-ink underline">
            Ver como cliente
          </Link>
        </p>
      </PageHeader>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
        <Stat dark label="Vendas de produtos" value={formatMoneyRound(revenue)} hint={`${formatInt(units)} unidades`} />
        <Stat label="Margem bruta" value={formatMoneyRound(margin)} hint={revenue ? `${formatPercent(margin / revenue)} da venda` : undefined} />
        <Stat label="Reservas pelo app" value={formatInt(reservations.length)} hint="para retirar na próxima visita" />
        <Stat label="Estoque baixo" value={formatInt(low.length)} hint={low.length ? "repor antes de acabar" : "tudo em dia"} />
      </div>

      {soon.length ? (
        <AssistantSays>
          <p>
            No ritmo dos últimos 30 dias, {soon.length === 1 ? "um produto acaba" : `${soon.length} produtos acabam`} em até 3 semanas:{" "}
            {soon
              .slice(0, 4)
              .map((f) => `${f.product.name} (${f.daysLeft === 0 ? "já acabou" : `${f.daysLeft} dias`})`)
              .join(", ")}
            . Repor agora evita perder venda no balcão.
          </p>
        </AssistantSays>
      ) : null}

      <Panel title="Vitrine e estoque" note="Ordenado pelo que mais vendeu no período" action={<AssistantTag />}>
        <DataTable
          minWidth={1080}
          head={
            <>
              <th>Produto</th>
              <th>Categoria</th>
              <th className="text-right">Preço</th>
              <th className="text-right">Estoque</th>
              <th className="text-right">Vendidos</th>
              <th className="text-right">Receita</th>
              <th className="text-right">Margem</th>
              <th className="text-right">Reservas</th>
              <th className="text-right">Acaba em</th>
              <th>Quem mais compra</th>
            </>
          }
        >
          {stats.map((p) => (
            <tr key={p.product.id}>
              <td>
                <span className="flex items-center gap-3">
                  <Photo src={p.product.photoUrl} alt="" className="size-10 shrink-0 rounded-lg" fallback="" />
                  <span className="font-semibold">{p.product.name}</span>
                </span>
              </td>
              <td>{CATEGORY[p.product.category]}</td>
              <td className="text-right">{formatMoney(p.product.priceCents)}</td>
              <td className="text-right">
                {p.lowStock ? <Badge tone={p.product.stock === 0 ? "bad" : "warn"}>{p.product.stock} un.</Badge> : `${p.product.stock} un.`}
              </td>
              <td className="text-right">{p.units}</td>
              <td className="text-right font-semibold">{formatMoneyRound(p.revenueCents)}</td>
              <td className="text-right">{formatMoneyRound(p.marginCents)}</td>
              <td className="text-right">{p.reserved || "—"}</td>
              <td className="text-right whitespace-nowrap">
                {(() => {
                  const f = forecastOf.get(p.product.id);
                  if (!f || f.daysLeft === null) return <span className="text-muted">—</span>;
                  return f.daysLeft <= 21 ? <Badge tone={f.daysLeft <= 7 ? "bad" : "warn"}>{f.daysLeft} dias</Badge> : `${f.daysLeft} dias`;
                })()}
              </td>
              <td className="text-[13px] text-muted">
                {(forecastOf.get(p.product.id)?.buyers ?? [])
                  .slice(0, 2)
                  .map((b) => b.customer.name.split(" ")[0])
                  .join(", ") || "—"}
              </td>
            </tr>
          ))}
        </DataTable>
      </Panel>

      <Panel title="Reservas para retirar" note="Feitas pelo app; o cliente paga na barbearia">
        {reservations.length ? (
          <ul className="flex flex-col divide-y divide-line-soft">
            {reservations.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
                <span>
                  <span className="font-semibold">{products.get(r.productId)?.name}</span>
                  <span className="block text-xs text-muted">
                    {customers.get(r.customerId)?.name} · {shortDate(dayKey(r.createdAt))}
                  </span>
                </span>
                <span className="font-semibold">{formatMoney((products.get(r.productId)?.priceCents ?? 0) * r.quantity)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>Nenhuma reserva aberta.</Empty>
        )}
      </Panel>
    </>
  );
}
