import Link from "next/link";
import type { Metadata } from "next";
import { DataTable, PageHeader, Panel, parsePeriod } from "@/components/dashboard";
import { Meter } from "@/components/ui";
import { barberRevenue, periodRange } from "@/domain/metrics";
import { formatInt, formatMoneyRound, formatPercent } from "@/domain/money";
import { loadSnapshot } from "@/server/data/store";

export const metadata: Metadata = { title: "Barbeiros" };

export default async function BarbersPage({ searchParams }: { searchParams: Promise<{ periodo?: string }> }) {
  const s = await loadSnapshot();
  const range = periodRange(parsePeriod((await searchParams).periodo), new Date(s.now));
  const all = barberRevenue(s, range, { includeInactive: true });
  const active = all.filter((b) => b.barber.active);
  const inactive = all.filter((b) => !b.barber.active);
  const total = active.reduce((t, b) => t + b.totalCents, 0);

  const rows = (list: typeof all) =>
    list.map((b) => (
      <tr key={b.barber.id}>
        <td>
          <span className="font-semibold">{b.barber.name}</span>
          <span className="block text-xs text-muted">{b.unitName}</span>
        </td>
        <td className="text-right">{formatInt(b.completed)}</td>
        <td className="text-right">{formatInt(b.clubVisits)}</td>
        <td className="text-right">{formatMoneyRound(b.walkInCents)}</td>
        <td className="text-right">{formatMoneyRound(b.clubShareCents)}</td>
        <td className="text-right">{formatMoneyRound(b.productCents)}</td>
        <td className="text-right font-semibold">{formatMoneyRound(b.totalCents)}</td>
        <td className="text-right">{total ? formatPercent(b.totalCents / total) : "—"}</td>
        <td>
          <div className="flex items-center gap-2">
            <Meter value={b.occupancy} label={`Ocupação de ${b.barber.name}`} className="w-16" />
            <span className="w-9 text-right text-xs">{formatPercent(b.occupancy)}</span>
          </div>
        </td>
        <td className="text-right">
          <Link href={`/painel/assinaturas?vendedor=${b.barber.id}`} className="font-semibold underline-offset-2 hover:underline">
            {b.plansSold}
          </Link>
        </td>
      </tr>
    ));

  const head = (
    <>
      <th>Barbeiro</th>
      <th className="text-right">Atend.</th>
      <th className="text-right">Pelo clube</th>
      <th className="text-right">Avulso</th>
      <th className="text-right">Clube</th>
      <th className="text-right">Produtos</th>
      <th className="text-right">Total</th>
      <th className="text-right">Parte</th>
      <th>Ocupação</th>
      <th className="text-right">Planos vendidos</th>
    </>
  );

  return (
    <>
      <PageHeader title="Barbeiros" range={range} path="/painel/barbeiros" />
      <Panel title="Faturamento por barbeiro ativo" note="Calculado a partir dos atendimentos concluídos, das cobranças do clube e das vendas de produtos.">
        <DataTable minWidth={980} head={head}>
          {rows(active)}
        </DataTable>
      </Panel>
      {inactive.length ? (
        <Panel title="Desligados com atendimentos no período" note="Ficam fora do ranking e das metas, mas entram no fechamento.">
          <DataTable minWidth={980} head={head}>
            {rows(inactive)}
          </DataTable>
        </Panel>
      ) : null}
      <div className="rounded-2xl bg-chip p-5 text-sm text-ink-soft">
        <p className="font-semibold text-ink">Como a receita do clube é dividida</p>
        <p className="mt-1">
          O valor cobrado dos assinantes no período é rateado entre os barbeiros pelo valor de tabela dos serviços que cada um fez pelo clube. Quem atendeu mais assinantes
          (ou serviços mais caros) recebe uma parte maior. A regra pode ser trocada (por atendimento, valor fixo por barbeiro) conforme o combinado da barbearia.
        </p>
      </div>
    </>
  );
}
