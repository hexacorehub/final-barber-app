import Link from "next/link";
import type { Metadata } from "next";
import { DataTable, PageHeader, Panel, parsePeriod } from "@/components/dashboard";
import { Meter } from "@/components/ui";
import { barberRevenue, periodRange } from "@/domain/metrics";
import { formatInt, formatMoneyRound, formatPercent } from "@/domain/money";
import { currentStaff } from "@/server/staff";
import { can } from "@/domain/access";
import { NoAccess } from "@/components/no-access";
import { painelSnapshot } from "@/server/painel-scope";
import { AssistantTag, WhatsAppButton } from "@/components/assistant";
import { Badge } from "@/components/ui";
import { gapsFor } from "@/domain/assistants/gap-fill";
import { dayWords, gapOffer, namesFor } from "@/domain/assistants/phrases";
import { addDays, dayKey, hhmm } from "@/domain/time";

export const metadata: Metadata = { title: "Barbeiros" };

export default async function BarbersPage({ searchParams }: { searchParams: Promise<{ periodo?: string }> }) {
  const staff = (await currentStaff())!;
  if (!can(staff, "revenue") && !can(staff, "agenda")) return <NoAccessPage title="Barbeiros" what="barbeiros" />;
  const s = await painelSnapshot();
  const range = periodRange(parsePeriod((await searchParams).periodo), new Date(s.now));
  const revenueGrant = can(staff, "revenue");
  const own = revenueGrant === "own" || can(staff, "agenda") === "own";
  const canOffer = Boolean(can(staff, "messages_marketing"));
  const all = barberRevenue(s, range, { includeInactive: true }).filter((b) => !own || b.barber.id === staff.barberId);
  const active = all.filter((b) => b.barber.active);
  const inactive = all.filter((b) => !b.barber.active);
  const total = active.reduce((t, b) => t + b.totalCents, 0);
  const tomorrow = addDays(dayKey(s.now), 1);
  const gaps = gapsFor(s, tomorrow).filter((g) => !own || g.barber.id === staff.barberId);
  const n = namesFor(s);

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
      {revenueGrant ? (
        <Panel title={own ? "Seu faturamento" : "Faturamento por barbeiro ativo"} note="Calculado a partir dos atendimentos concluídos, das cobranças do clube e das vendas de produtos.">
          <DataTable minWidth={980} head={head}>
            {rows(active)}
          </DataTable>
        </Panel>
      ) : null}
      <div id="encaixe" className="scroll-mt-6">
        <Panel
          title={`Encaixe de ${dayWords(tomorrow, s.now)}`}
          note="Horários livres de cada barbeiro e os clientes dele que estão no ponto de voltar e costumam vir nesse horário"
          action={<AssistantTag />}
        >
          {gaps.length ? (
            <ul className="flex flex-col divide-y divide-line-soft">
              {gaps.map((g) => (
                <li key={g.barber.id} className="flex flex-col gap-2.5 px-5 py-4">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="font-semibold">{g.barber.name}</span>
                    <span className="text-sm">{(Math.round((g.freeMinutes / 60) * 10) / 10).toLocaleString("pt-BR")} h livres</span>
                    <span className="text-[13px] text-muted">{g.windows.map((w) => `${hhmm(w.start)}–${hhmm(w.end)}`).join(" · ")}</span>
                  </div>
                  {g.offers.length ? (
                    <ul className="flex flex-col gap-2">
                      {g.offers.map((o) => (
                        <li key={o.customer.id} className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="w-12 font-semibold">{hhmm(o.start)}</span>
                          <span className="font-semibold">{o.customer.name}</span>
                          <Badge tone={o.member ? "dark" : "neutral"}>{o.member ? "Assinante" : "Avulso"}</Badge>
                          <span className="text-[13px] text-muted">
                            {o.lateByDays > 0 ? `${o.lateByDays} dias além do ritmo` : o.lateByDays === 0 ? "no ponto de voltar" : `volta em ${-o.lateByDays} dias`}
                          </span>
                          {canOffer ? (
                            <WhatsAppButton phone={o.to.phone} text={gapOffer(o.to, o.customer, g.barber.id, tomorrow, o.start, s.now, n)} label="Oferecer" className="ml-auto" track={{ kind: "gap_offer", customerId: o.customer.id }} />
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[13px] text-muted">Nenhum cliente dele no ponto de voltar para esses horários.</p>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-5 py-6 text-sm text-muted">Agenda de amanhã cheia ou barbearia fechada.</p>
          )}
        </Panel>
      </div>
      {inactive.length && revenueGrant && !own ? (
        <Panel title="Desligados com atendimentos no período" note="Ficam fora do ranking e das metas, mas entram no fechamento.">
          <DataTable minWidth={980} head={head}>
            {rows(inactive)}
          </DataTable>
        </Panel>
      ) : null}
      <div className={revenueGrant ? "rounded-2xl bg-chip p-5 text-sm text-ink-soft" : "hidden"}>
        <p className="font-semibold text-ink">Como a receita do clube é dividida</p>
        <p className="mt-1">
          O valor cobrado dos assinantes no período é rateado entre os barbeiros pelo valor de tabela dos serviços que cada um fez pelo clube. Quem atendeu mais assinantes
          (ou serviços mais caros) recebe uma parte maior. A regra pode ser trocada (por atendimento, valor fixo por barbeiro) conforme o combinado da barbearia.
        </p>
      </div>
    </>
  );
}

function NoAccessPage({ title, what }: { title: string; what: string }) {
  return (
    <>
      <PageHeader title={title} path="/painel" />
      <NoAccess what={what} />
    </>
  );
}
