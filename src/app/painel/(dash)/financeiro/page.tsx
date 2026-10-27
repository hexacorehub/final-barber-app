import type { Metadata } from "next";
import { ArrowUpRight, Check } from "lucide-react";
import { DataTable, Legend, PageHeader, Panel, SOURCE_SEGMENTS, StackedBar, parsePeriod } from "@/components/dashboard";
import { Badge, Stat, buttonStyles, cn } from "@/components/ui";
import { barberRevenue, clubTotals, periodRange, referralStats, revenueMix, upcomingClubCharges } from "@/domain/metrics";
import { formatMoneyCompact, formatMoneyRound, formatPercent } from "@/domain/money";
import { loadSnapshot } from "@/server/data/store";
import { AssistantSays } from "@/components/assistant";

export const metadata: Metadata = { title: "Financeiro" };

/**
 * Only the money numbers that come from the barbershop operation live here (sources,
 * commissions, club receivables). Cash flow, bills, taxes, invoices and the accountant
 * belong to Final Finance — this page points there instead of rebuilding them.
 */
export default async function FinancePage({ searchParams }: { searchParams: Promise<{ periodo?: string }> }) {
  const s = await loadSnapshot();
  const range = periodRange(parsePeriod((await searchParams).periodo), new Date(s.now));
  const mix = revenueMix(s, range);
  const barbers = barberRevenue(s, range, { includeInactive: true });
  const club = clubTotals(s, range);
  const upcoming = upcomingClubCharges(s, 30);
  const referrals = referralStats(s, range);
  const commissions = barbers.map((b) => ({ ...b, commission: b.serviceCommissionCents + b.productCommissionCents }));
  const totalCommission = commissions.reduce((t, b) => t + b.commission, 0);
  const financeUrl = process.env.FINAL_FINANCE_URL || null;

  const sources = [
    { ...SOURCE_SEGMENTS.walkIn, value: mix.walkInCents },
    { ...SOURCE_SEGMENTS.club, label: "Mister Club (já com descontos de indicação)", value: mix.clubCents },
    { ...SOURCE_SEGMENTS.product, value: mix.productCents },
  ];

  return (
    <>
      <PageHeader title="Financeiro" range={range} path="/painel/financeiro" />

      <AssistantSays>
        <p>
          {range.label[0].toUpperCase() + range.label.slice(1)}, entraram <strong>{formatMoneyRound(mix.totalCents)}</strong>:{" "}
          {formatPercent(mix.totalCents ? mix.walkInCents / mix.totalCents : 0)} de serviços avulsos, {formatPercent(mix.totalCents ? mix.clubCents / mix.totalCents : 0)} do clube e{" "}
          {formatPercent(mix.totalCents ? mix.productCents / mix.totalCents : 0)} de produtos. As comissões somam {formatMoneyRound(totalCommission)}.
        </p>
        <p className="text-muted">
          {referrals.discountsInRangeCents
            ? `Os descontos de indicação custaram ${formatMoneyRound(referrals.discountsInRangeCents)} e trouxeram ${referrals.joinedInRange} ${referrals.joinedInRange === 1 ? "assinatura" : "assinaturas"} no período. `
            : ""}
          Nos próximos 30 dias estão previstas {upcoming.count} mensalidades, {formatMoneyRound(upcoming.totalCents)}. Caixa, contas e impostos ficam no Final Finance.
        </p>
      </AssistantSays>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
        <Stat dark label="Entrou no período" value={formatMoneyCompact(mix.totalCents)} hint="serviços, clube e produtos" />
        <Stat label="Comissões a pagar" value={formatMoneyCompact(totalCommission)} hint={mix.totalCents ? `${formatPercent(totalCommission / mix.totalCents)} do faturamento` : undefined} />
        <Stat label="Clube nos próximos 30 dias" value={formatMoneyCompact(upcoming.totalCents)} hint={`${upcoming.count} cobranças previstas`} />
        <Stat label="Clube em atraso" value={formatMoneyRound(club.pastDueCents)} hint={`${club.pastDue} cartões recusados`} />
        <Stat label="Descontos de indicação" value={formatMoneyRound(referrals.discountsInRangeCents)} hint={`${referrals.joinedInRange} assinantes novos por indicação`} />
      </div>

      <div className="flex flex-wrap gap-6">
        <Panel title="De onde veio o dinheiro" className="flex-[1_1_380px]">
          <div className="flex flex-col gap-4 px-5 py-5">
            <StackedBar max={mix.totalCents} segments={sources} label="Divisão do faturamento por origem" />
            <Legend items={Object.values(SOURCE_SEGMENTS)} />
            <ul className="flex flex-col divide-y divide-line-soft text-sm">
              {sources.map((x) => (
                <li key={x.label} className="flex items-center justify-between py-2.5">
                  <span>{x.label}</span>
                  <span>
                    <span className="font-semibold">{formatMoneyRound(x.value)}</span>
                    <span className="ml-2 inline-block w-10 text-right text-muted">{mix.totalCents ? formatPercent(x.value / mix.totalCents) : "—"}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Panel>

        <Panel title="Comissões do período" className="flex-[999_1_560px]" note="Serviços: % sobre avulso + parte do clube · Produtos: % sobre a venda">
          <DataTable
            minWidth={520}
            head={
              <>
                <th>Barbeiro</th>
                <th className="text-right">Serviços</th>
                <th className="text-right">Produtos</th>
                <th className="text-right">Total</th>
              </>
            }
          >
            {commissions.map((b) => (
              <tr key={b.barber.id}>
                <td>
                  <span className="font-semibold">{b.barber.name}</span>
                  <span className="block text-xs text-muted">
                    {formatPercent(b.barber.serviceCommission)} serviços · {formatPercent(b.barber.productCommission)} produtos
                  </span>
                </td>
                <td className="text-right">{formatMoneyRound(b.serviceCommissionCents)}</td>
                <td className="text-right">{formatMoneyRound(b.productCommissionCents)}</td>
                <td className="text-right font-semibold">{formatMoneyRound(b.commission)}</td>
              </tr>
            ))}
          </DataTable>
        </Panel>
      </div>

      <section className="flex flex-col gap-5 rounded-2xl bg-ink p-6 text-white md:flex-row md:items-center md:gap-10 md:p-8">
        <div className="flex flex-1 flex-col gap-3">
          <Badge className="self-start bg-white text-ink">Complemento</Badge>
          <h2 className="font-display text-[26px] leading-tight font-semibold">Feche o mês no Final Finance</h2>
          <p className="text-[15px] leading-relaxed text-[#d6d6d6]">
            Aqui você vê o que a barbearia produziu. Para o resto da gestão financeira, os números deste painel seguem para o Final Finance, sem digitar nada duas vezes.
          </p>
          {financeUrl ? (
            <a href={financeUrl} target="_blank" rel="noreferrer" className={cn(buttonStyles.inverse, "self-start")}>
              Conhecer o Final Finance <ArrowUpRight size={18} aria-hidden="true" />
            </a>
          ) : (
            <span className="self-start rounded-xl border border-[#3a3a3a] px-4 py-2.5 text-sm text-[#d6d6d6]">Integração disponível em breve</span>
          )}
        </div>
        <div className="grid flex-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2 rounded-xl bg-[#1c1c1c] p-4">
            <p className="text-xs font-semibold tracking-[0.08em] text-[#bdbdbd] uppercase">Neste painel</p>
            {["Faturamento por barbeiro", "Receita do clube e atrasos", "Comissões", "Vendas de produtos"].map((x) => (
              <p key={x} className="flex items-center gap-2 text-sm">
                <Check size={15} aria-hidden="true" /> {x}
              </p>
            ))}
          </div>
          <div className="flex flex-col gap-2 rounded-xl border border-[#3a3a3a] p-4">
            <p className="text-xs font-semibold tracking-[0.08em] text-[#bdbdbd] uppercase">No Final Finance</p>
            {["Fluxo de caixa e contas a pagar", "Impostos da empresa", "Notas fiscais e contador", "Planejamento e projeções"].map((x) => (
              <p key={x} className="flex items-center gap-2 text-sm">
                <ArrowUpRight size={15} aria-hidden="true" /> {x}
              </p>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
