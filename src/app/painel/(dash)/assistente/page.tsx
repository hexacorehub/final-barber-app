import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { Empty, PageHeader, Panel } from "@/components/dashboard";
import { AssistantSays, AssistantTag } from "@/components/assistant";
import { Badge, Stat, cn } from "@/components/ui";
import { SUGGESTED_QUESTIONS } from "@/domain/assistants/ask";
import { scoreboard, type Outcome } from "@/domain/assistants/scoreboard";
import { weeklyBrief } from "@/domain/assistants/weekly-brief";
import { SITUATIONS, type Situation } from "@/domain/assistants/outbox";
import { formatInt, formatMoneyRound, formatPercent } from "@/domain/money";
import { dayKey, shortDate } from "@/domain/time";
import { painelSnapshot } from "@/server/painel-scope";
import { actionLog } from "@/server/assistants/log";
import { aiProvider, write } from "@/server/assistants/writer";
import { AskBox } from "./ask-box";

export const metadata: Metadata = { title: "Assistente" };

const OUTCOME: Record<Exclude<Outcome, null>, string> = { subscribed: "Assinou", came_back: "Voltou", paid: "Pagou" };
const KIND_LABEL: Record<string, string> = {
  offer_in_person: "Oferta no balcão",
  plan_request: "Pedido de plano",
  fill_gap: "Encaixe",
  ...Object.fromEntries(Object.entries(SITUATIONS).map(([k, v]) => [k, v.label])),
};

export default async function AssistantPage() {
  const s = await painelSnapshot();
  const brief = weeklyBrief(s);
  const headline = await write({ task: "resumo da semana para o dono", fallback: brief.headline, numbers: brief.numbers });
  const { log, simulated } = await actionLog(s);
  const board = scoreboard(s, log);
  const names = new Map(s.customers.map((c) => [c.id, c.name]));
  const provider = aiProvider();

  return (
    <>
      <PageHeader title="Assistente" path="/painel/assistente">
        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
          <AssistantTag />
          <span>Pergunte, veja a semana e o que as sugestões trouxeram</span>
        </div>
      </PageHeader>

      <Panel title="Perguntar" note="Sobre faturamento, barbeiros, planos, assinantes, faltas, ocupação, produtos e candidatos. Dá para dizer o período e a unidade.">
        <AskBox suggestions={SUGGESTED_QUESTIONS} />
      </Panel>

      <section className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-xl font-semibold">Resumo da semana</h2>
          <AssistantTag engine={headline.engine} />
          <span className="text-sm text-muted">
            {shortDate(brief.from)} a {shortDate(brief.to)}
          </span>
        </div>
        <AssistantSays>
          <p>{headline.text}</p>
        </AssistantSays>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(180px,1fr))] gap-3">
          {brief.facts.map((f) => {
            const good = f.change === null || f.change === 0 ? null : f.change > 0 === f.upIsGood;
            return (
              <div key={f.label} className="flex flex-col gap-1 rounded-2xl border border-line p-4">
                <span className="text-[13px] text-muted">{f.label}</span>
                <span className="font-display text-2xl">{f.now}</span>
                <span className={cn("flex items-center gap-1 text-[13px]", good === null ? "text-muted" : good ? "text-ok" : "text-bad")}>
                  {f.change === null ? null : f.change >= 0 ? <ArrowUpRight size={14} aria-hidden="true" /> : <ArrowDownRight size={14} aria-hidden="true" />}
                  {f.change === null ? "sem base de comparação" : `${formatPercent(Math.abs(f.change))} · antes ${f.before}`}
                </span>
              </div>
            );
          })}
        </div>
        {brief.priorities.length ? (
          <Panel title="Comece por aqui" note="As três ações de maior valor de hoje">
            <ol className="flex flex-col divide-y divide-line-soft">
              {brief.priorities.map((a, i) => (
                <li key={a.id}>
                  <Link href={a.href} className="flex items-center gap-3 px-5 py-3 hover:bg-chip">
                    <span className="w-5 font-display text-muted">{i + 1}</span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="text-sm font-semibold">{a.title}</span>
                      <span className="truncate text-xs text-muted">{a.reason}</span>
                    </span>
                    <span className="text-sm font-semibold">{formatMoneyRound(a.valueCents)}</span>
                    <ArrowRight size={16} aria-hidden="true" />
                  </Link>
                </li>
              ))}
            </ol>
          </Panel>
        ) : null}
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-display text-xl font-semibold">Placar do assistente</h2>
          <span className="text-sm text-muted">últimos 30 dias · resultado em até 14 dias depois da mensagem</span>
        </div>
        {simulated ? (
          <p className="rounded-xl bg-chip px-4 py-3 text-[13px] text-ink-soft">
            Na demonstração, o histórico de mensagens é simulado a partir do que aconteceu nos dados de teste. As mensagens que você abrir agora também entram aqui.
          </p>
        ) : null}
        <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-4">
          <Stat dark label="Receita recorrente nova" value={formatMoneyRound(board.newMrrCents)} hint="por mês, de quem assinou depois da mensagem" />
          <Stat label="Mensagens abertas" value={formatInt(board.sent)} hint={`${formatInt(board.results)} com resultado (${formatPercent(board.sent ? board.results / board.sent : 0)})`} />
          <Stat label="Visitas recuperadas" value={formatMoneyRound(board.visitsCents)} hint="de quem voltou depois do lembrete" />
          <Stat label="Cobranças regularizadas" value={formatMoneyRound(board.feesCents)} hint="mensalidades pagas depois do aviso" />
        </div>
        <Panel title="Últimas mensagens">
          {board.items.length ? (
            <ul className="flex flex-col divide-y divide-line-soft">
              {board.items.slice(0, 12).map((x) => (
                <li key={x.action.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                  <span className="w-14 text-[13px] text-muted">{shortDate(dayKey(x.action.at))}</span>
                  <span className="flex-1 font-semibold">{names.get(x.action.customerId) ?? "Cliente"}</span>
                  <span className="text-[13px] text-muted">{KIND_LABEL[x.action.kind as Situation] ?? x.action.kind}</span>
                  {x.outcome ? <Badge tone="ok">{OUTCOME[x.outcome]}</Badge> : <Badge>Sem resposta ainda</Badge>}
                  <span className="w-20 text-right">{x.valueCents ? formatMoneyRound(x.valueCents) : ""}</span>
                </li>
              ))}
            </ul>
          ) : (
            <Empty>Nenhuma mensagem aberta pelas sugestões ainda.</Empty>
          )}
        </Panel>
      </section>

      <div className="rounded-2xl bg-chip p-5 text-sm text-ink-soft">
        <p className="font-semibold text-ink">Como os assistentes funcionam</p>
        <p className="mt-1">
          As decisões e os números saem de regras sobre os dados da barbearia: visitas, planos, agenda e vendas. O selo <strong>Assistente</strong> marca o que foi montado por
          regra. Quando um modelo de IA estiver ligado, ele só reescreve o texto a partir desses números, e o selo vira <strong>Assistente · IA</strong>. Se o texto da IA
          mudar algum número, o app usa o da regra.
        </p>
        <p className="mt-2">Texto por IA: {provider === "none" ? "desligado (sem custo)." : `ligado (${provider}).`}</p>
      </div>
    </>
  );
}
