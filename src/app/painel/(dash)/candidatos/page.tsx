import type { Metadata } from "next";
import Link from "next/link";
import { DataTable, Empty, PageHeader, Panel } from "@/components/dashboard";
import { AssistantSays, AssistantTag, WhatsAppButton } from "@/components/assistant";
import { Badge, Stat, cn } from "@/components/ui";
import { candidateInsights, clubCandidates, type CandidateSegment, type Chance, type ClubCandidate } from "@/domain/assistants/candidates";
import { candidateReason, counterScript, dayWords, inviteMessage, momentText, namesFor, planShort, timeOf } from "@/domain/assistants/phrases";
import { formatInt, formatMoneyCompact, formatMoneyRound, formatPercent } from "@/domain/money";
import { loadSnapshot } from "@/server/data/store";

export const metadata: Metadata = { title: "Candidatos ao clube" };

const SEGMENT_LABEL: Record<CandidateSegment, string> = { saves: "Economiza", even: "Mesmo valor", near: "Quase lá" };
const CHANCE_LABEL: Record<Chance, string> = { alta: "Alta", media: "Média", baixa: "Baixa" };
const FILTERS: { id: "todos" | Chance; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "alta", label: "Alta chance" },
  { id: "media", label: "Média" },
  { id: "baixa", label: "Baixa" },
];

export default async function CandidatesPage({ searchParams }: { searchParams: Promise<{ chance?: string }> }) {
  const s = await loadSnapshot();
  const n = namesFor(s);
  const list = clubCandidates(s);
  const ins = candidateInsights(s, list);
  const chance = ((await searchParams).chance ?? "todos") as "todos" | Chance;
  const shown = chance === "todos" ? list : list.filter((c) => c.chance === chance);
  const likely = ins.byChance.alta + ins.byChance.media;
  const likelyMrr = ins.potentialMrrByChance.alta + ins.potentialMrrByChance.media;
  const growth = ins.currentMrrCents ? likelyMrr / ins.currentMrrCents : 0;
  const funnel = [
    { label: "Vieram sem plano nos últimos 90 dias", value: ins.walkInsActive },
    { label: "Voltaram 2 vezes ou mais", value: ins.walkInsRegular },
    { label: "Têm perfil de assinante", value: ins.candidates },
    { label: "Alta ou média chance", value: likely },
  ];

  return (
    <>
      <PageHeader title="Candidatos ao clube" path="/painel/candidatos">
        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
          <AssistantTag />
          <span>Assistente do Clube · análise das visitas dos últimos 90 dias</span>
        </div>
      </PageHeader>

      <AssistantSays>
        <p>
          Encontrei <strong>{formatInt(ins.candidates)} clientes</strong> que pagam por visita e têm perfil de assinante.{" "}
          <strong>{formatInt(likely)} têm chance alta ou média</strong>: no plano certo pagariam o mesmo ou menos do que pagam hoje. Se eles assinarem, a receita
          recorrente sobe <strong>{formatMoneyRound(likelyMrr)} por mês</strong> ({formatPercent(growth)} sobre os {formatMoneyCompact(ins.currentMrrCents)} de hoje).
        </p>
        {ins.comingThisWeek.length ? (
          <p className="text-muted">
            {formatInt(ins.comingThisWeek.length)} deles já têm horário nos próximos 7 dias: a oferta pode ser feita pessoalmente, no balcão.
          </p>
        ) : null}
      </AssistantSays>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
        <Stat dark label="Receita recorrente possível" value={formatMoneyCompact(likelyMrr)} hint="por mês, chance alta e média" />
        <Stat label="Candidatos" value={formatInt(ins.candidates)} hint={`${ins.bySegment.saves} economizam · ${ins.bySegment.even} mesmo valor · ${ins.bySegment.near} quase lá`} />
        <Stat label="Alta chance" value={formatInt(ins.byChance.alta)} hint={`${formatMoneyRound(ins.potentialMrrByChance.alta)}/mês se assinarem`} />
        <Stat label="Economia para os clientes" value={formatMoneyRound(ins.customerSavingsCents)} hint="por mês, somando quem economiza" />
      </div>

      <div className="flex flex-wrap items-start gap-6">
        <Panel title="Do avulso ao clube" className="flex-[1_1_420px]" note="Quantos clientes sem plano passam em cada etapa da análise">
          <ol className="flex flex-col gap-4 px-5 py-5">
            {funnel.map((f, i) => (
              <li key={f.label} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className={cn(i === funnel.length - 1 && "font-semibold")}>{f.label}</span>
                  <span className="font-semibold">{formatInt(f.value)}</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-line-soft" role="img" aria-label={`${f.label}: ${f.value}`}>
                  <div className={cn("h-full rounded-full", i === funnel.length - 1 ? "bg-ink" : "bg-src-club")} style={{ width: `${(f.value / Math.max(1, funnel[0].value)) * 100}%` }} />
                </div>
              </li>
            ))}
          </ol>
          <p className="border-t border-line-soft px-5 py-3 text-[13px] text-muted">
            Perfil de assinante: 2 visitas ou mais e cerca de uma por mês, e algum plano que custa o mesmo, menos, ou compensa com uma visita a mais.
          </p>
        </Panel>

        <Panel title="Vêm esta semana" className="flex-[999_1_480px]" note="Já têm horário: ofereça pessoalmente, com a conta na ponta da língua">
          {ins.comingThisWeek.length ? (
            <ul className="flex flex-col divide-y divide-line-soft">
              {ins.comingThisWeek.slice(0, 8).map((c) => (
                <li key={c.customer.id} className="flex flex-col gap-1 px-5 py-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{c.customer.name}</span>
                    <ChanceBadge c={c} />
                    <span className="ml-auto text-[13px] text-muted">
                      {dayWords(c.moment.day, s.now)} às {c.moment.startsAt ? timeOf(c.moment.startsAt) : ""} · {n.barber(c.moment.barberId)}
                    </span>
                  </div>
                  <p className="text-[13px] text-muted">
                    {planShort(c.plan)} · {counterScript(c)}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Nenhum candidato com horário nos próximos 7 dias.</Empty>
          )}
        </Panel>
      </div>

      <div className="flex flex-wrap items-start gap-6">
        <Panel title="Quem deve oferecer" className="flex-[999_1_480px]" note="O barbeiro que mais atende cada candidato: quem tem a relação faz a oferta">
          <DataTable
            minWidth={480}
            head={
              <>
                <th>Barbeiro</th>
                <th className="text-right">Candidatos</th>
                <th className="text-right">Alta chance</th>
                <th className="text-right">Vêm esta semana</th>
                <th className="text-right">Possível/mês</th>
              </>
            }
          >
            {ins.byBarber.map((b) => (
              <tr key={b.barber.id}>
                <td className="font-semibold">{b.barber.name}</td>
                <td className="text-right">{b.count}</td>
                <td className="text-right">{b.high}</td>
                <td className="text-right">{b.thisWeek}</td>
                <td className="text-right font-semibold">{formatMoneyRound(b.potentialMrrCents)}</td>
              </tr>
            ))}
          </DataTable>
        </Panel>

        <Panel title="Plano indicado" className="flex-[1_1_300px]" note="O plano que deixa cada candidato melhor">
          <ul className="flex flex-col divide-y divide-line-soft">
            {ins.byPlan.map((p) => (
              <li key={p.plan.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <span className="font-semibold">{planShort(p.plan)}</span>
                <span>
                  {p.count} · <span className="text-muted">{formatMoneyRound(p.potentialMrrCents)}/mês</span>
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel
        title="Todos os candidatos"
        note="Ordenados pela chance de a conversa dar certo: economia, frequência, regularidade e se a visita é recente"
        action={
          <nav aria-label="Filtrar por chance" className="flex gap-1 rounded-xl bg-chip p-1">
            {FILTERS.map((f) => (
              <Link
                key={f.id}
                href={f.id === "todos" ? "/painel/candidatos" : `/painel/candidatos?chance=${f.id}`}
                aria-current={chance === f.id ? "page" : undefined}
                className={cn("flex h-9 items-center rounded-lg px-3 text-[13px] font-semibold", chance === f.id ? "bg-ink text-white" : "text-ink-soft hover:bg-white")}
              >
                {f.label}
              </Link>
            ))}
          </nav>
        }
      >
        {shown.length ? (
          <DataTable
            minWidth={980}
            head={
              <>
                <th className="w-[38%]">Cliente e motivo</th>
                <th>Chance</th>
                <th>Plano indicado</th>
                <th>Quando oferecer</th>
                <th className="text-right">Ação</th>
              </>
            }
          >
            {shown.slice(0, 40).map((c) => (
              <tr key={c.customer.id} className="align-top">
                <td>
                  <span className="font-semibold">{c.customer.name}</span>
                  {c.decider.id !== c.customer.id ? <span className="text-xs text-muted"> · conta de {c.decider.name.split(" ")[0]}</span> : null}
                  <span className="mt-0.5 block text-xs leading-relaxed text-muted">{candidateReason(c, n)}</span>
                </td>
                <td>
                  <ChanceBadge c={c} />
                  <span className="mt-1 block text-xs text-muted">
                    {SEGMENT_LABEL[c.segment]} · nota {c.score}
                  </span>
                </td>
                <td>
                  <span className="font-semibold">{planShort(c.plan)}</span>
                  <span className="block text-xs whitespace-nowrap text-muted">
                    {formatMoneyRound(c.payNowCents)} → {formatMoneyRound(c.inPlanCents)}/mês
                  </span>
                </td>
                <td className="text-[13px]">{momentText(c, n, s.now)}</td>
                <td className="text-right">
                  <WhatsAppButton phone={c.decider.phone} text={inviteMessage(c, n)} label="Convidar" />
                </td>
              </tr>
            ))}
          </DataTable>
        ) : (
          <Empty>Nenhum candidato nesta faixa.</Empty>
        )}
        {shown.length > 40 ? <p className="border-t border-line-soft px-5 py-3 text-[13px] text-muted">Mostrando os 40 primeiros de {shown.length}.</p> : null}
      </Panel>
    </>
  );
}

function ChanceBadge({ c }: { c: ClubCandidate }) {
  return <Badge tone={c.chance === "alta" ? "ok" : "neutral"}>{CHANCE_LABEL[c.chance]} chance</Badge>;
}
