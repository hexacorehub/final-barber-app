import type { Metadata } from "next";
import Link from "next/link";
import { DataTable, Empty, PageHeader, Panel } from "@/components/dashboard";
import { AssistantSays, AssistantTag, WhatsAppButton } from "@/components/assistant";
import { Badge, Stat, cn } from "@/components/ui";
import { bySeller, filterRows, subscriptionRows, summarizeRows, winBackList, type SubFilter, type SubRow, type SubStatus } from "@/domain/assistants/subscriptions";
import { cardDeclined, memberLate, namesFor, planShort, winBack, type Names } from "@/domain/assistants/phrases";
import { formatInt, formatMoneyCompact, formatMoneyRound, formatPercent } from "@/domain/money";
import { dayKey, shortDate } from "@/domain/time";
import type { SalesChannel } from "@/domain/types";
import { painelSnapshot } from "@/server/painel-scope";

export const metadata: Metadata = { title: "Assinaturas" };

type Params = { status?: string; vendedor?: string; indicacao?: string; canal?: string; plano?: string; periodo?: string };

const STATUS: { id: SubStatus | "all"; label: string }[] = [
  { id: "all", label: "Todas" },
  { id: "active", label: "Ativas" },
  { id: "risk", label: "Em risco" },
  { id: "paused", label: "Pausadas" },
  { id: "canceled", label: "Canceladas" },
];
const CHANNEL_LABEL: Record<SalesChannel, string> = { counter: "Balcão", whatsapp: "WhatsApp", app: "App" };
const PERIODS = [
  { id: "", label: "Desde sempre" },
  { id: "30", label: "30 dias" },
  { id: "90", label: "90 dias" },
  { id: "365", label: "12 meses" },
];

export default async function SubscriptionsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const s = await painelSnapshot();
  const q = await searchParams;
  const n = namesFor(s);
  const filter: SubFilter = {
    status: (STATUS.some((x) => x.id === q.status) ? q.status : "all") as SubFilter["status"],
    seller: q.vendedor || undefined,
    referral: q.indicacao === "com" ? "with" : q.indicacao === "sem" ? "without" : undefined,
    channel: q.canal && q.canal in CHANNEL_LABEL ? (q.canal as SalesChannel) : undefined,
    plan: q.plano || undefined,
    days: q.periodo ? Number(q.periodo) || undefined : undefined,
  };
  const all = subscriptionRows(s);
  const rows = filterRows(all, filter, s.now);
  const sum = summarizeRows(rows);
  const sellers = bySeller(filterRows(all, { ...filter, seller: undefined }, s.now), s.barbers);
  const winBacks = winBackList(rows).slice(0, 8);
  const href = (patch: Partial<Params>) => {
    const next = { ...q, ...patch };
    const qs = new URLSearchParams(Object.entries(next).filter(([, v]) => v) as [string, string][]).toString();
    return `/painel/assinaturas${qs ? `?${qs}` : ""}`;
  };
  const sellerName = filter.seller === "none" ? "sem barbeiro" : filter.seller ? s.barbers.find((b) => b.id === filter.seller)?.name : null;

  return (
    <>
      <PageHeader title="Assinaturas" path="/painel/assinaturas">
        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
          <AssistantTag />
          <span>Assistente do Clube · quem entrou, por onde, quem ficou e quem saiu</span>
        </div>
      </PageHeader>

      <div className="flex flex-col gap-2.5 rounded-2xl border border-line p-4">
        <ChipRow label="Status">
          {STATUS.map((x) => (
            <Chip key={x.id} href={href({ status: x.id === "all" ? "" : x.id })} active={filter.status === x.id} label={x.label} />
          ))}
        </ChipRow>
        <ChipRow label="Vendido por">
          <Chip href={href({ vendedor: "" })} active={!filter.seller} label="Todos" />
          {s.barbers
            .filter((b) => all.some((r) => r.sub.soldByBarberId === b.id))
            .map((b) => (
              <Chip key={b.id} href={href({ vendedor: b.id })} active={filter.seller === b.id} label={b.name.split(" ")[0]} />
            ))}
          <Chip href={href({ vendedor: "none" })} active={filter.seller === "none"} label="Sem barbeiro" />
        </ChipRow>
        <ChipRow label="Indicação">
          <Chip href={href({ indicacao: "" })} active={!filter.referral} label="Todas" />
          <Chip href={href({ indicacao: "com" })} active={filter.referral === "with"} label="Com indicação" />
          <Chip href={href({ indicacao: "sem" })} active={filter.referral === "without"} label="Sem indicação" />
        </ChipRow>
        <ChipRow label="Canal">
          <Chip href={href({ canal: "" })} active={!filter.channel} label="Todos" />
          {(Object.keys(CHANNEL_LABEL) as SalesChannel[]).map((c) => (
            <Chip key={c} href={href({ canal: c })} active={filter.channel === c} label={CHANNEL_LABEL[c]} />
          ))}
        </ChipRow>
        <ChipRow label="Plano">
          <Chip href={href({ plano: "" })} active={!filter.plan} label="Todos" />
          {s.plans.map((p) => (
            <Chip key={p.id} href={href({ plano: p.id })} active={filter.plan === p.id} label={planShort(p)} />
          ))}
        </ChipRow>
        <ChipRow label="Período">
          {PERIODS.map((p) => (
            <Chip key={p.id} href={href({ periodo: p.id })} active={(q.periodo ?? "") === p.id} label={p.label} />
          ))}
        </ChipRow>
        <p className="text-xs text-muted">Período: conta a data de início; nas canceladas, a data do cancelamento.</p>
      </div>

      <AssistantSays>
        <p>
          {sellerName ? `Vendidas ${filter.seller === "none" ? "" : "por "}${sellerName}: ` : "Nesta seleção: "}
          <strong>{formatInt(sum.count)} assinaturas</strong>, {formatInt(sum.current)} em vigor ({formatMoneyRound(sum.mrrCents)} por mês) e{" "}
          {formatInt(sum.canceled)} canceladas ({formatPercent(sum.cancelShare)}). Em média, cada uma durou ou dura <strong>{sum.avgMonths.toLocaleString("pt-BR")} meses</strong>.
        </p>
        {sum.winBackHigh ? (
          <p className="text-muted">
            {formatInt(sum.winBackHigh)} ex-assinantes têm alta chance de voltar: cancelaram há pouco, ficaram bastante tempo ou continuam vindo pagando avulso.
          </p>
        ) : null}
      </AssistantSays>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
        <Stat dark label="Receita recorrente" value={formatMoneyCompact(sum.mrrCents)} hint="por mês, ativas da seleção" />
        <Stat label="Em vigor" value={formatInt(sum.current)} hint="ativas, em risco e pausadas" />
        <Stat label="Canceladas" value={formatInt(sum.canceled)} hint={`${formatPercent(sum.cancelShare)} da seleção`} />
        <Stat label="Tempo médio" value={`${sum.avgMonths.toLocaleString("pt-BR")} meses`} hint="do início até hoje ou ao cancelamento" />
      </div>

      <div className="flex flex-wrap items-start gap-6">
        <Panel title="Por quem vendeu" className="flex-[1_1_380px]" note="Toque para filtrar. Conta tudo da seleção, menos o filtro de vendedor.">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs tracking-[0.06em] text-muted uppercase [&>th]:px-3 [&>th]:py-2.5 [&>th:first-child]:pl-5 [&>th:last-child]:pr-5">
                <th>Vendedor</th>
                <th className="text-right">Em vigor</th>
                <th className="text-right">Cancel.</th>
                <th className="text-right">Por mês</th>
              </tr>
            </thead>
            <tbody>
              {sellers.map((x) => (
                <tr key={x.id} className={cn("border-t border-line-soft hover:bg-chip [&>td]:px-3 [&>td]:py-2.5 [&>td:first-child]:pl-5 [&>td:last-child]:pr-5", filter.seller === x.id && "bg-chip")}>
                  <td>
                    <Link href={href({ vendedor: x.id })} className="font-semibold underline-offset-2 hover:underline">
                      {x.name}
                    </Link>
                  </td>
                  <td className="text-right whitespace-nowrap">{x.current}</td>
                  <td className="text-right whitespace-nowrap text-muted">{x.canceled}</td>
                  <td className="text-right font-semibold whitespace-nowrap">{formatMoneyRound(x.mrrCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <Panel title="Reconquista" className="flex-[999_1_480px]" note="Ex-assinantes dos últimos 6 meses com chance de voltar, nesta seleção">
          {winBacks.length ? (
            <ul className="flex flex-col divide-y divide-line-soft">
              {winBacks.map((r) => (
                <li key={r.sub.id} className="flex flex-col gap-2 px-5 py-3 text-sm md:flex-row md:items-center md:gap-4">
                  <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{r.customer.name}</span>
                      <Badge tone={r.winBack!.chance === "alta" ? "ok" : "neutral"}>{r.winBack!.chance === "alta" ? "Alta chance" : "Média chance"}</Badge>
                    </span>
                    <span className="text-[13px] text-muted">
                      {planShort(r.plan)} por {r.months} {r.months === 1 ? "mês" : "meses"} · cancelou em {r.sub.canceledAt ? shortDate(dayKey(r.sub.canceledAt)) : ""}
                      {r.visitsAfterCancel ? ` · voltou ${r.visitsAfterCancel}x pagando avulso` : ""}
                      {r.sub.cancelReason ? ` · motivo: ${r.sub.cancelReason.toLowerCase()}` : ""}
                    </span>
                  </div>
                  <WhatsAppButton phone={r.payer.phone} text={winBack(r.payer, r.plan, r.months, r.visitsAfterCancel, n)} label="Chamar de volta" track={{ kind: "win_back", customerId: r.customer.id }} />
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Nenhum ex-assinante com boa chance de voltar nesta seleção.</Empty>
          )}
        </Panel>
      </div>

      <Panel title="Lista" note={rows.length > 60 ? `Mostrando as 60 mais recentes de ${formatInt(rows.length)}` : `${formatInt(rows.length)} assinaturas`}>
        {rows.length ? (
          <DataTable
            minWidth={1080}
            head={
              <>
                <th>Assinante</th>
                <th>Plano</th>
                <th>Período</th>
                <th>Vendido por</th>
                <th>Canal</th>
                <th>Indicação</th>
                <th>Status</th>
                <th>Última visita</th>
                <th className="text-right">Ação</th>
              </>
            }
          >
            {rows.slice(0, 60).map((r) => (
              <tr key={r.sub.id} className="align-top">
                <td>
                  <span className="font-semibold">{r.customer.name}</span>
                  {r.payer.id !== r.customer.id ? <span className="block text-xs text-muted">pago por {r.payer.name.split(" ")[0]}</span> : null}
                </td>
                <td className="whitespace-nowrap">{planShort(r.plan)}</td>
                <td className="text-[13px] whitespace-nowrap">
                  {shortDate(dayKey(r.sub.startedAt))}
                  {r.sub.canceledAt ? ` → ${shortDate(dayKey(r.sub.canceledAt))}` : ""}
                  <span className="block text-xs text-muted">
                    {r.months} {r.months === 1 ? "mês" : "meses"}
                  </span>
                </td>
                <td className="text-[13px]">{r.seller?.name.split(" ")[0] ?? <span className="text-muted">Sem barbeiro</span>}</td>
                <td className="text-[13px]">{CHANNEL_LABEL[r.sub.channel]}</td>
                <td className="text-[13px]">{r.referrer ? r.referrer.name.split(" ")[0] : <span className="text-muted">—</span>}</td>
                <td>
                  <StatusBadge r={r} />
                  {r.sub.cancelReason ? <span className="mt-1 block text-xs text-muted">{r.sub.cancelReason}</span> : null}
                </td>
                <td className="text-[13px] whitespace-nowrap">{r.lastVisit ? shortDate(r.lastVisit) : "—"}</td>
                <td className="text-right">
                  <RowAction r={r} n={n} />
                </td>
              </tr>
            ))}
          </DataTable>
        ) : (
          <Empty>Nenhuma assinatura com esses filtros.</Empty>
        )}
      </Panel>
    </>
  );
}

function StatusBadge({ r }: { r: SubRow }) {
  if (r.status === "canceled") return <Badge>Cancelada</Badge>;
  if (r.status === "paused") return <Badge>Pausada</Badge>;
  if (r.status === "risk") return <Badge tone={r.riskReason === "past_due" ? "bad" : "warn"}>{r.riskReason === "past_due" ? "Cartão recusado" : "Sumido"}</Badge>;
  return <Badge tone="ok">Ativa</Badge>;
}

function RowAction({ r, n }: { r: SubRow; n: Names }) {
  if (r.status === "risk" && r.riskReason === "past_due") return <WhatsAppButton phone={r.payer.phone} text={cardDeclined(r.payer, r.plan)} label="Enviar Pix" track={{ kind: "card_declined", customerId: r.customer.id }} />;
  if (r.status === "risk") return <WhatsAppButton phone={r.payer.phone} text={memberLate(r.payer, r.plan, r.daysSinceVisit ?? 0, r.seller?.id ?? null, n)} label="Lembrar" track={{ kind: "member_late", customerId: r.customer.id }} />;
  if (r.status === "canceled" && r.winBack) return <WhatsAppButton phone={r.payer.phone} text={winBack(r.payer, r.plan, r.months, r.visitsAfterCancel, n)} label="Chamar" track={{ kind: "win_back", customerId: r.customer.id }} />;
  return null;
}

function ChipRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-24 shrink-0 text-[13px] text-muted">{label}</span>
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto">{children}</div>
    </div>
  );
}

function Chip({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn("flex h-8 shrink-0 items-center rounded-full px-3 text-[13px] font-semibold whitespace-nowrap", active ? "bg-ink text-white" : "bg-chip text-ink-soft hover:bg-line")}
    >
      {label}
    </Link>
  );
}
