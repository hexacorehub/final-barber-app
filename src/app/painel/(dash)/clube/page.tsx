import type { Metadata } from "next";
import { MessageCircle } from "lucide-react";
import { DataTable, Empty, PageHeader, Panel, parsePeriod } from "@/components/dashboard";
import { Badge, Meter, Stat } from "@/components/ui";
import { messages, whatsappMessage } from "@/components/whatsapp";
import { clubTotals, memberHistory, periodRange, planIndicators, plansSoldByBarber, retentionRisk, upsellCandidates } from "@/domain/metrics";
import { formatInt, formatMoney, formatMoneyCompact, formatMoneyRound, formatPercent } from "@/domain/money";
import { dayKey, monthShort, shortDate } from "@/domain/time";
import { loadSnapshot } from "@/server/data/store";

export const metadata: Metadata = { title: "Mister Club" };

const short = (name: string) => name.replace("Mister Club ", "");

export default async function ClubDashboardPage({ searchParams }: { searchParams: Promise<{ periodo?: string }> }) {
  const s = await loadSnapshot();
  const range = periodRange(parsePeriod((await searchParams).periodo), new Date(s.now));
  const totals = clubTotals(s, range);
  const plans = planIndicators(s, range);
  const history = memberHistory(s, 6);
  const maxMembers = Math.max(...history.map((h) => h.members), 1);
  const upsell = upsellCandidates(s);
  const risk = retentionRisk(s);
  const sellers = plansSoldByBarber(s, range);
  const customers = new Map(s.customers.map((c) => [c.id, c]));
  const plansById = new Map(s.plans.map((p) => [p.id, p]));
  const leads = s.leads
    .filter((l) => !s.subscriptions.some((x) => x.customerId === l.customerId && x.status !== "canceled"))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const fromApp = s.subscriptions.filter((x) => x.channel === "app" && x.status !== "canceled").length;

  return (
    <>
      <PageHeader title="Mister Club" range={range} path="/painel/clube" />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
        <Stat dark label="Receita recorrente" value={formatMoneyCompact(totals.mrrCents)} hint="por mês" />
        <Stat label="Assinantes" value={formatInt(totals.members)} hint={`${totals.dependents} dependentes · ${totals.paused} pausados`} />
        <Stat label="Entradas e saídas" value={`+${totals.newInRange} / −${totals.canceledInRange}`} hint="no período" />
        <Stat label="Pagamentos recusados" value={formatInt(totals.pastDue)} hint={`${formatMoneyRound(totals.pastDueCents)} a recuperar`} />
        <Stat label="Vendidos pelo app" value={formatInt(fromApp)} hint="assinaturas ativas" />
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(300px,1fr))] gap-4">
        {plans.map((p) => (
          <article key={p.plan.id} className="flex flex-col gap-3 rounded-2xl border border-line p-5">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h2 className="font-display text-lg leading-tight font-semibold">{short(p.plan.name)}</h2>
                <p className="text-[13px] text-muted">{formatMoney(p.plan.priceCents)} por mês</p>
              </div>
              {totals.bestSeller?.id === p.plan.id ? <Badge tone="dark">Mais vendido</Badge> : null}
            </div>
            <div className="flex items-baseline justify-between">
              <span className="font-display text-[30px] tracking-normal">{formatInt(p.members)}</span>
              <span className="text-sm text-muted">{formatPercent(p.share)} dos assinantes</span>
            </div>
            <Meter value={p.share} label={`Participação do ${short(p.plan.name)}`} />
            <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13px]">
              <dt className="text-muted">Receita/mês</dt>
              <dd className="text-right font-semibold">{formatMoneyRound(p.mrrCents)}</dd>
              <dt className="text-muted">Novos · cancelados</dt>
              <dd className="text-right">
                +{p.newInRange} · −{p.canceledInRange}
              </dd>
              <dt className="text-muted">Cancelamento</dt>
              <dd className="text-right">{formatPercent(p.churn)}</dd>
              <dt className="text-muted">Cartão recusado</dt>
              <dd className="text-right">{p.pastDue}</dd>
            </dl>
          </article>
        ))}
      </div>

      <Panel title="Evolução dos assinantes" note="Assinaturas em vigor no fim de cada mês">
        <div className="flex h-56 items-end gap-3 px-5 pt-6 pb-4">
          {history.map((h) => (
            <div key={h.month} className="flex h-full flex-1 flex-col items-center justify-end gap-1.5">
              <span className="text-xs font-semibold">{h.members}</span>
              <div className="w-full max-w-16 rounded-t-md bg-ink" style={{ height: `${(h.members / maxMembers) * 100}%` }} role="img" aria-label={`${monthShort(h.month)}: ${h.members} assinantes`} />
              <span className="text-xs text-muted">{monthShort(h.month)}</span>
            </div>
          ))}
        </div>
      </Panel>

      <div id="indicar" className="scroll-mt-6">
        <Panel title="Indique o clube para estes clientes" note="Pagam por visita e gastariam menos num plano, pelo que consumiram nos últimos 90 dias">
          {upsell.length ? (
            <DataTable
              minWidth={760}
              head={
                <>
                  <th>Cliente</th>
                  <th className="text-right">Visitas/mês</th>
                  <th className="text-right">Gasta/mês</th>
                  <th>Plano indicado</th>
                  <th className="text-right">Economia/mês</th>
                  <th className="text-right">Ação</th>
                </>
              }
            >
              {upsell.slice(0, 15).map((u) => (
                <tr key={u.customer.id}>
                  <td>
                    <span className="font-semibold">{u.customer.name}</span>
                    <span className="block text-xs text-muted">Última visita {shortDate(u.lastVisit)}</span>
                  </td>
                  <td className="text-right">{u.visitsPerMonth.toLocaleString("pt-BR")}</td>
                  <td className="text-right">{formatMoneyRound(u.monthlySpendCents)}</td>
                  <td>{short(u.plan.name)}</td>
                  <td className="text-right font-semibold">{formatMoneyRound(u.monthlySavingCents)}</td>
                  <td className="text-right">
                    <WhatsAppLink href={whatsappMessage(u.customer.phone, messages.invite(u.customer.name, short(u.plan.name), formatMoneyRound(u.monthlySavingCents)))} label="Convidar" />
                  </td>
                </tr>
              ))}
            </DataTable>
          ) : (
            <Empty>Nenhum cliente avulso gastaria menos no clube agora.</Empty>
          )}
        </Panel>
      </div>

      <div className="flex flex-wrap gap-6">
        <div id="interessados" className="flex-[1_1_380px] scroll-mt-6">
          <Panel title="Interessados pelo app" note="Pediram para assinar; confirme e ative a cobrança">
            {leads.length ? (
              <ul className="flex flex-col divide-y divide-line-soft">
                {leads.map((l) => {
                  const c = customers.get(l.customerId);
                  const plan = plansById.get(l.planId);
                  if (!c || !plan) return null;
                  return (
                    <li key={l.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="font-semibold">{c.name}</span>
                        <span className="text-xs text-muted">
                          {short(plan.name)} · {shortDate(dayKey(l.createdAt))}
                        </span>
                      </span>
                      <WhatsAppLink href={whatsappMessage(c.phone, messages.lead(c.name, short(plan.name)))} label="Confirmar" />
                    </li>
                  );
                })}
              </ul>
            ) : (
              <Empty>Nenhum pedido novo.</Empty>
            )}
          </Panel>
        </div>
        <Panel title="Quem vendeu" className="flex-[1_1_320px]" note="Assinaturas novas no período por barbeiro">
          {sellers.length ? (
            <ol className="flex flex-col divide-y divide-line-soft">
              {sellers.map((x) => (
                <li key={x.barber.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                  <span className="font-semibold">{x.barber.name}</span>
                  <span>
                    {x.count} · <span className="text-muted">+{formatMoneyRound(x.mrrCents)}/mês</span>
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <Empty>Nenhuma venda atribuída no período.</Empty>
          )}
        </Panel>
      </div>

      <div id="risco" className="scroll-mt-6">
        <Panel title="Assinantes em risco" note="Cartão recusado, ou sem visita bem além do ritmo de costume e sem horário marcado">
          {risk.length ? (
            <DataTable
              minWidth={720}
              head={
                <>
                  <th>Assinante</th>
                  <th>Plano</th>
                  <th>Sinal</th>
                  <th className="text-right">Ação</th>
                </>
              }
            >
              {risk.slice(0, 20).map((r) => (
                <tr key={r.subscription.id}>
                  <td>
                    <span className="font-semibold">{r.customer.name}</span>
                    <span className="block text-xs text-muted">
                      {r.daysSinceVisit !== null ? `Última visita há ${r.daysSinceVisit} ${r.daysSinceVisit === 1 ? "dia" : "dias"} · costuma vir a cada ${r.customer.cycleDays}` : "Sem visitas registradas"}
                    </span>
                  </td>
                  <td>{short(r.plan.name)}</td>
                  <td>{r.reason === "past_due" ? <Badge tone="bad">Pagamento recusado</Badge> : <Badge tone="warn">Atrasado {r.lateByDays} dias</Badge>}</td>
                  <td className="text-right">
                    <WhatsAppLink
                      href={whatsappMessage(r.customer.phone, r.reason === "past_due" ? messages.pastDue(r.customer.name) : messages.lateReminder(r.customer.name))}
                      label={r.reason === "past_due" ? "Enviar Pix" : "Lembrar"}
                    />
                  </td>
                </tr>
              ))}
            </DataTable>
          ) : (
            <Empty>Nenhum assinante em risco agora.</Empty>
          )}
        </Panel>
      </div>
    </>
  );
}

function WhatsAppLink({ href, label }: { href: string; label: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border-[1.5px] border-ink px-3 text-[13px] font-semibold whitespace-nowrap hover:bg-chip">
      <MessageCircle size={15} aria-hidden="true" /> {label}
    </a>
  );
}
