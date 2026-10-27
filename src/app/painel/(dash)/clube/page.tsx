import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, MessageCircle } from "lucide-react";
import { DataTable, Empty, PageHeader, Panel, parsePeriod } from "@/components/dashboard";
import { Badge, Meter, Stat } from "@/components/ui";
import { messages, whatsappMessage } from "@/components/whatsapp";
import { clubTotals, memberHistory, periodRange, planIndicators, plansSoldByBarber, referralCredits, referralStats, retentionRisk } from "@/domain/metrics";
import { clubCandidates } from "@/domain/assistants/candidates";
import { inviteMessage, namesFor } from "@/domain/assistants/phrases";
import { RELATIONSHIP_LABEL } from "@/domain/household";
import { formatInt, formatMoney, formatMoneyCompact, formatMoneyRound, formatPercent } from "@/domain/money";
import { dayKey, monthShort, shortDate } from "@/domain/time";
import { painelSnapshot } from "@/server/painel-scope";

export const metadata: Metadata = { title: "Mister Club" };

const short = (name: string) => name.replace("Mister Club ", "");

export default async function ClubDashboardPage({ searchParams }: { searchParams: Promise<{ periodo?: string }> }) {
  const s = await painelSnapshot();
  const range = periodRange(parsePeriod((await searchParams).periodo), new Date(s.now));
  const totals = clubTotals(s, range);
  const plans = planIndicators(s, range);
  const history = memberHistory(s, 6);
  const maxMembers = Math.max(...history.map((h) => h.members), 1);
  const candidates = clubCandidates(s);
  const names = namesFor(s);
  const risk = retentionRisk(s);
  const sellers = plansSoldByBarber(s, range);
  const customers = new Map(s.customers.map((c) => [c.id, c]));
  const plansById = new Map(s.plans.map((p) => [p.id, p]));
  const leads = s.leads
    .filter((l) => !s.subscriptions.some((x) => x.customerId === l.customerId && x.planId === l.planId && x.status !== "canceled"))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const fromApp = s.subscriptions.filter((x) => x.channel === "app" && x.status !== "canceled").length;
  const referrals = referralStats(s, range);
  const credits = referralCredits(s);
  const queued = credits.filter((c) => c.status === "queued").length;
  const lost = credits.filter((c) => c.status === "expired" || c.status === "over_limit").length;
  const currentPlanOf = (customerId: string) => {
    const sub = s.subscriptions.find((x) => x.customerId === customerId && x.status !== "canceled");
    return sub ? plansById.get(sub.planId) : undefined;
  };

  return (
    <>
      <PageHeader title="Mister Club" range={range} path="/painel/clube" />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
        <Stat dark label="Receita recorrente" value={formatMoneyCompact(totals.mrrCents)} hint="por mês" />
        <Stat label="Assinantes" value={formatInt(totals.members)} hint={`${totals.dependents} em contas familiares · ${totals.paused} pausados`} />
        <Link href="/painel/assinaturas" className="rounded-2xl hover:ring-2 hover:ring-ink">
          <Stat label="Entradas e saídas" value={`+${totals.newInRange} / −${totals.canceledInRange}`} hint="no período · ver todas" />
        </Link>
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
        <Panel
          title="Candidatos ao clube"
          note="Pagam por visita e ficariam iguais ou melhores num plano, pelas visitas dos últimos 90 dias"
          action={
            <Link href="/painel/candidatos" className="flex min-h-11 items-center gap-1 text-sm font-semibold">
              Análise completa <ArrowRight size={16} aria-hidden="true" />
            </Link>
          }
        >
          {candidates.length ? (
            <DataTable
              minWidth={760}
              head={
                <>
                  <th>Cliente</th>
                  <th className="text-right">Visitas/mês</th>
                  <th className="text-right">Paga/mês</th>
                  <th>Plano indicado</th>
                  <th className="text-right">No plano</th>
                  <th className="text-right">Ação</th>
                </>
              }
            >
              {candidates.slice(0, 8).map((c) => (
                <tr key={c.customer.id}>
                  <td>
                    <span className="font-semibold">{c.customer.name}</span>
                    <span className="block text-xs text-muted">
                      {c.chance === "alta" ? "Alta chance" : c.chance === "media" ? "Média chance" : "Baixa chance"} · última visita {c.stats.lastVisit ? shortDate(c.stats.lastVisit) : "—"}
                    </span>
                  </td>
                  <td className="text-right">{c.stats.visitsPerMonth.toLocaleString("pt-BR")}</td>
                  <td className="text-right">{formatMoneyRound(c.payNowCents)}</td>
                  <td>{short(c.plan.name)}</td>
                  <td className="text-right font-semibold">{formatMoneyRound(c.inPlanCents)}</td>
                  <td className="text-right">
                    <WhatsAppLink href={whatsappMessage(c.decider.phone, inviteMessage(c, names))} label="Convidar" />
                  </td>
                </tr>
              ))}
            </DataTable>
          ) : (
            <Empty>Nenhum cliente avulso com perfil de assinante agora.</Empty>
          )}
        </Panel>
      </div>

      <div className="flex flex-wrap gap-6">
        <div id="interessados" className="flex-[1_1_380px] scroll-mt-6">
          <Panel title="Pedidos pelo app" note="Novas assinaturas e trocas de plano; confirme e ative a cobrança">
            {leads.length ? (
              <ul className="flex flex-col divide-y divide-line-soft">
                {leads.map((l) => {
                  const c = customers.get(l.customerId);
                  const holder = customers.get(l.requestedById);
                  const plan = plansById.get(l.planId);
                  if (!c || !plan) return null;
                  const forOther = holder && holder.id !== c.id;
                  const from = currentPlanOf(c.id);
                  const referrer = l.referrerCustomerId ? customers.get(l.referrerCustomerId) : undefined;
                  return (
                    <li key={l.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <span className="flex flex-wrap items-center gap-1.5 font-semibold">
                          {c.name}
                          {l.kind === "upgrade" ? <Badge tone="ok">Troca de plano</Badge> : null}
                          {referrer ? <Badge>Indicado por {referrer.name.split(" ")[0]}</Badge> : null}
                        </span>
                        <span className="text-xs text-muted">
                          {l.kind === "upgrade" && from ? `${short(from.name)} → ` : ""}
                          {short(plan.name)} · {shortDate(dayKey(l.createdAt))}
                          {forOther ? ` · pedido pelo titular ${holder.name.split(" ")[0]}${c.relationship ? ` (${RELATIONSHIP_LABEL[c.relationship].toLowerCase()})` : ""}` : ""}
                        </span>
                      </span>
                      <WhatsAppLink href={whatsappMessage((forOther ? holder : c).phone, messages.lead((forOther ? holder : c).name, short(plan.name)))} label="Confirmar" />
                    </li>
                  );
                })}
              </ul>
            ) : (
              <Empty>Nenhum pedido novo.</Empty>
            )}
          </Panel>
        </div>
        <Panel
          title="Quem vendeu"
          className="flex-[1_1_320px]"
          note="Assinaturas novas no período por barbeiro"
          action={
            <Link href="/painel/assinaturas?vendedor=none" className="flex min-h-11 items-center gap-1 text-sm font-semibold">
              Sem barbeiro <ArrowRight size={16} aria-hidden="true" />
            </Link>
          }
        >
          {sellers.length ? (
            <ol className="flex flex-col divide-y divide-line-soft">
              {sellers.map((x) => (
                <li key={x.barber.id}>
                  <Link href={`/painel/assinaturas?vendedor=${x.barber.id}`} className="flex items-center justify-between gap-3 px-5 py-3 text-sm hover:bg-chip">
                    <span className="font-semibold">{x.barber.name}</span>
                    <span>
                      {x.count} · <span className="text-muted">+{formatMoneyRound(x.mrrCents)}/mês</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          ) : (
            <Empty>Nenhuma venda atribuída no período.</Empty>
          )}
        </Panel>
      </div>

      <div id="indicacoes" className="scroll-mt-6">
        <Panel
          title="Programa de indicação"
          note="Cada amigo vale 50% em uma mensalidade do titular que indicou, um desconto por mês, depois da 1ª mensalidade paga do amigo"
          action={
            <div className="flex gap-1">
              <Link href="/painel/assinaturas?indicacao=com" className="flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-semibold hover:bg-chip">
                Com indicação <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link href="/painel/assinaturas?indicacao=sem" className="flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-semibold hover:bg-chip">
                Sem indicação <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          }
        >
          <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-px border-b border-line-soft bg-line-soft">
            {[
              ["Novos por indicação", `${referrals.joinedInRange}`, "no período"],
              ["Indicados ativos", `${referrals.activeReferred}`, `${formatMoneyRound(referrals.mrrFromReferralsCents)}/mês`],
              ["Descontos concedidos", formatMoneyRound(referrals.discountsInRangeCents), "no período"],
              ["Convites aguardando", `${referrals.pendingLeads}`, "pedidos pelo app"],
              ["Descontos na fila", `${queued}`, `${lost} vencidos ou além do limite`],
            ].map(([label, value, hint]) => (
              <div key={label} className="flex flex-col gap-1 bg-white px-5 py-4">
                <span className="text-[13px] text-muted">{label}</span>
                <span className="font-display text-2xl tracking-normal">{value}</span>
                <span className="text-xs text-muted">{hint}</span>
              </div>
            ))}
          </div>
          {referrals.topReferrers.length ? (
            <ol className="flex flex-col divide-y divide-line-soft">
              {referrals.topReferrers.map((x, i) => (
                <li key={x.customer.id} className="flex items-center gap-3 px-5 py-3 text-sm">
                  <span className="w-5 font-display text-muted">{i + 1}</span>
                  <span className="flex-1 font-semibold">{x.customer.name}</span>
                  <span>
                    {x.count} {x.count === 1 ? "amigo" : "amigos"}
                  </span>
                  <span className="w-28 text-right text-muted">{formatMoneyRound(x.mrrCents)}/mês</span>
                </li>
              ))}
            </ol>
          ) : (
            <Empty>Nenhuma assinatura por indicação ainda.</Empty>
          )}
        </Panel>
      </div>

      <div id="risco" className="scroll-mt-6">
        <Panel
          title="Assinantes em risco"
          note="Cartão recusado, ou sem visita bem além do ritmo de costume e sem horário marcado"
          action={
            <div className="flex gap-1">
              <Link href="/painel/assinaturas?status=risk" className="flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-semibold hover:bg-chip">
                Em risco <ArrowRight size={16} aria-hidden="true" />
              </Link>
              <Link href="/painel/assinaturas?status=canceled" className="flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-semibold hover:bg-chip">
                Canceladas <ArrowRight size={16} aria-hidden="true" />
              </Link>
            </div>
          }
        >
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
