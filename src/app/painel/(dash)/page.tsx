import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { DataTable, Empty, Legend, PageHeader, Panel, SOURCE_SEGMENTS, StackedBar, parsePeriod } from "@/components/dashboard";
import { Badge, Stat } from "@/components/ui";
import {
  barberRevenue,
  clubTotals,
  periodRange,
  planIndicators,
  plansSoldByBarber,
  productStats,
  revenueMix,
} from "@/domain/metrics";
import { ownerDay } from "@/domain/assistants/owner-actions";
import { TodayPanel } from "./today-panel";
import { formatInt, formatMoney, formatMoneyCompact, formatMoneyRound, formatPercent } from "@/domain/money";
import { painelSnapshot, painelUnit } from "@/server/painel-scope";
import { unitBreakdown } from "@/domain/units";
import { entityOf } from "@/domain/legal-entities";

export const metadata: Metadata = { title: "Painel" };

export default async function OverviewPage({ searchParams }: { searchParams: Promise<{ periodo?: string }> }) {
  const s = await painelSnapshot();
  const range = periodRange(parsePeriod((await searchParams).periodo), new Date(s.now));
  const mix = revenueMix(s, range);
  const barbers = barberRevenue(s, range);
  const club = clubTotals(s, range);
  const plans = planIndicators(s, range);
  const day = ownerDay(s);
  const unit = await painelUnit();
  const units = unit ? [] : unitBreakdown(s, range);
  const sellers = plansSoldByBarber(s, range).slice(0, 5);
  const products = productStats(s, range);
  const occupancy = barbers.length ? barbers.reduce((t, b) => t + b.occupancy, 0) / barbers.length : 0;
  const maxBarber = Math.max(...barbers.map((b) => b.totalCents), 1);
  const qs = range.id === "mes" ? "" : `?periodo=${range.id}`;

  return (
    <>
      <PageHeader title="Visão geral" range={range} path="/painel" />

      <TodayPanel day={day} />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
        <Stat dark label="Faturamento" value={formatMoneyCompact(mix.totalCents)} hint={`${formatInt(mix.completed)} atendimentos`} />
        <Stat label="Receita recorrente do clube" value={formatMoneyCompact(club.mrrCents)} hint="por mês, assinantes ativos" />
        <Stat label="Assinantes" value={formatInt(club.members)} hint={`+${club.newInRange} novos · −${club.canceledInRange} cancelados`} />
        <Stat label="Ticket médio avulso" value={formatMoneyRound(mix.avgWalkInTicketCents)} hint={`${formatInt(mix.walkInVisits)} visitas pagas na hora`} />
        <Stat label="Ocupação da agenda" value={formatPercent(occupancy)} hint={`${mix.noShows} faltas no período`} />
      </div>

      {units.length > 1 ? (
        <Panel title="Por unidade" note="Mensalidades contam na unidade que cobra o plano. Escolha uma unidade no topo para ver o painel só dela.">
          <DataTable
            minWidth={760}
            head={
              <>
                <th>Unidade</th>
                <th className="text-right">Faturamento</th>
                <th className="text-right">Atendimentos</th>
                <th className="text-right">Ocupação</th>
                <th className="text-right">Planos cobrados</th>
                <th className="text-right">Recorrente/mês</th>
              </>
            }
          >
            {units.map((u) => (
              <tr key={u.unit.id}>
                <td>
                  <span className="font-semibold">{u.unit.name}</span>
                  <span className="block text-xs text-muted">{u.unit.cnpj ? `CNPJ ${u.unit.cnpj}${entityOf(s, u.unit.id)?.branches ? " · filial da mesma empresa" : ""}` : "Sem CNPJ cadastrado"}</span>
                </td>
                <td className="text-right font-semibold">{formatMoneyRound(u.revenueCents)}</td>
                <td className="text-right">{formatInt(u.completed)}</td>
                <td className="text-right">{formatPercent(u.occupancy)}</td>
                <td className="text-right">{formatInt(u.members)}</td>
                <td className="text-right">{formatMoneyRound(u.mrrCents)}</td>
              </tr>
            ))}
          </DataTable>
        </Panel>
      ) : null}

      <Panel
        title="Faturamento por barbeiro ativo"
        note="Avulso + parte do clube (rateada pelo valor dos serviços que cada um atendeu) + produtos vendidos"
        action={
          <Link href={`/painel/barbeiros${qs}`} className="flex min-h-11 items-center gap-1 text-sm font-semibold">
            Detalhes <ArrowRight size={16} aria-hidden="true" />
          </Link>
        }
      >
        <div className="flex flex-col gap-3.5 px-5 py-4">
          <Legend items={Object.values(SOURCE_SEGMENTS)} />
          {barbers.map((b) => (
            <div key={b.barber.id} className="grid grid-cols-[minmax(110px,160px)_1fr_auto] items-center gap-3 text-sm">
              <span className="truncate">
                <span className="font-semibold">{b.barber.name}</span>
                <span className="block text-xs text-muted">{b.unitName}</span>
              </span>
              <StackedBar
                max={maxBarber}
                label={`${b.barber.name}: ${formatMoneyRound(b.totalCents)}`}
                segments={[
                  { ...SOURCE_SEGMENTS.walkIn, value: b.walkInCents },
                  { ...SOURCE_SEGMENTS.club, value: b.clubShareCents },
                  { ...SOURCE_SEGMENTS.product, value: b.productCents },
                ]}
              />
              <span className="w-24 text-right font-semibold">{formatMoneyRound(b.totalCents)}</span>
            </div>
          ))}
        </div>
      </Panel>

      <div className="flex flex-wrap gap-6">
        <Panel
          title="Mister Club por plano"
          className="flex-[999_1_560px]"
          action={
            <Link href={`/painel/clube${qs}`} className="flex min-h-11 items-center gap-1 text-sm font-semibold">
              Detalhes <ArrowRight size={16} aria-hidden="true" />
            </Link>
          }
        >
          <DataTable
            minWidth={560}
            head={
              <>
                <th>Plano</th>
                <th className="text-right">Assinantes</th>
                <th className="text-right">Receita/mês</th>
                <th className="text-right">Novos</th>
                <th className="text-right">Cancel.</th>
              </>
            }
          >
            {plans.map((p) => (
              <tr key={p.plan.id}>
                <td>
                  <span className="font-semibold">{p.plan.name.replace("Mister Club ", "")}</span>
                  {club.bestSeller?.id === p.plan.id ? (
                    <Badge tone="dark" className="ml-2">
                      Mais vendido
                    </Badge>
                  ) : null}
                  <span className="block text-xs text-muted">{formatMoney(p.plan.priceCents)}</span>
                </td>
                <td className="text-right">{formatInt(p.members)}</td>
                <td className="text-right">{formatMoneyRound(p.mrrCents)}</td>
                <td className="text-right">+{p.newInRange}</td>
                <td className="text-right">{p.canceledInRange ? `−${p.canceledInRange}` : "0"}</td>
              </tr>
            ))}
          </DataTable>
        </Panel>

      </div>

      <div className="flex flex-wrap gap-6">
        <Panel title="Quem mais vendeu o clube" className="flex-[1_1_320px]" note="Assinaturas novas atribuídas a cada barbeiro no período">
          {sellers.length ? (
            <ol className="flex flex-col divide-y divide-line-soft">
              {sellers.map((x, i) => (
                <li key={x.barber.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                  <span className="w-5 font-display text-muted">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate font-semibold">{x.barber.name}</span>
                  <span className="flex flex-col items-end whitespace-nowrap">
                    <span>{x.count} {x.count === 1 ? "plano" : "planos"}</span>
                    <span className="text-xs text-muted">+{formatMoneyRound(x.mrrCents)}/mês</span>
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <Empty>Nenhuma assinatura nova atribuída a barbeiros no período.</Empty>
          )}
        </Panel>

        <Panel
          title="Produtos mais vendidos"
          className="flex-[999_1_480px]"
          action={
            <Link href={`/painel/produtos${qs}`} className="flex min-h-11 items-center gap-1 text-sm font-semibold">
              Vitrine <ArrowRight size={16} aria-hidden="true" />
            </Link>
          }
        >
          <ol className="flex flex-col divide-y divide-line-soft">
            {products.slice(0, 5).map((p) => (
              <li key={p.product.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                <span className="flex-1 font-semibold">{p.product.name}</span>
                {p.lowStock ? <Badge tone="warn">Estoque baixo</Badge> : null}
                <span className="w-16 text-right text-muted">{p.units} un.</span>
                <span className="w-24 text-right font-semibold">{formatMoneyRound(p.revenueCents)}</span>
              </li>
            ))}
          </ol>
        </Panel>
      </div>
    </>
  );
}
