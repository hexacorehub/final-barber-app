import type { Metadata } from "next";
import Link from "next/link";
import { PlugZap } from "lucide-react";
import { DataTable, Empty, PageHeader, Panel } from "@/components/dashboard";
import { AssistantSays, AssistantTag, MessageBubble, WhatsAppButton } from "@/components/assistant";
import { Badge, Stat, cn } from "@/components/ui";
import { frontDeskTime, outboxToday, outboxVolume30d, SITUATION_ORDER, SITUATIONS, type Situation } from "@/domain/assistants/outbox";
import { first, timeOf } from "@/domain/assistants/phrases";
import { formatInt } from "@/domain/money";
import { loadSnapshot } from "@/server/data/store";

export const metadata: Metadata = { title: "WhatsApp" };

const hours = (minutes: number) => (minutes < 90 ? `${formatInt(Math.round(minutes))} min` : `${formatInt(Math.round(minutes / 60))} h`);

export default async function WhatsAppPage({ searchParams }: { searchParams: Promise<{ situacao?: string }> }) {
  const s = await loadSnapshot();
  const queue = outboxToday(s);
  const volume = outboxVolume30d(s);
  const time = frontDeskTime(s, volume);
  const wanted = (await searchParams).situacao as Situation | undefined;
  const filter = wanted && wanted in SITUATIONS ? wanted : null;
  const shown = filter ? queue.filter((i) => i.situation === filter) : queue;
  const countBy = new Map<Situation, number>();
  for (const i of queue) countBy.set(i.situation, (countBy.get(i.situation) ?? 0) + 1);
  const readyNow = queue.filter((i) => i.sendAt <= s.now).length;

  return (
    <>
      <PageHeader title="WhatsApp" path="/painel/whatsapp">
        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
          <AssistantTag />
          <span>Assistente de mensagens · lembretes, clube e cobrança</span>
        </div>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-chip p-4 md:p-5">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white">
          <PlugZap size={20} aria-hidden="true" />
        </span>
        <div className="flex min-w-[240px] flex-1 flex-col gap-0.5">
          <p className="font-semibold">WhatsApp ainda não conectado</p>
          <p className="text-[13px] text-ink-soft">
            O assistente já monta cada mensagem no momento certo. Por enquanto, cada uma abre no WhatsApp da barbearia com um toque; com a API oficial do WhatsApp
            conectada, elas saem sozinhas no horário indicado.
          </p>
        </div>
        <Badge tone="dark">Pronto para conectar</Badge>
      </div>

      <AssistantSays>
        <p>
          Pelo movimento dos últimos 30 dias, a recepção faria <strong>{formatInt(time.messages)} mensagens</strong> à mão, cerca de{" "}
          <strong>{hours(time.minutes)} de trabalho por mês</strong>. Com o envio automático, esse tempo volta para o atendimento no balcão.
        </p>
        <p className="text-muted">
          Além disso, {formatInt(time.whatsappBookings)} agendamentos chegaram pelo WhatsApp no mesmo período, mais uns {hours(time.bookingMinutes)} de conversa que um
          agente de agendamento pode assumir quando o WhatsApp estiver conectado.
        </p>
      </AssistantSays>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-4">
        <Stat dark label="Recepção poupada" value={hours(time.minutes)} hint="por mês, com as automações ligadas" />
        <Stat label="Prontas hoje" value={formatInt(queue.length)} hint={`${readyNow} já podem sair agora`} />
        <Stat label="Mensagens por mês" value={formatInt(time.messages)} hint="pelo histórico dos últimos 30 dias" />
        <Stat label="Agendamentos pelo WhatsApp" value={formatInt(time.whatsappBookings)} hint="últimos 30 dias" />
      </div>

      <Panel title="Automações" note="Cada situação, quando sai e quanto aparece no seu movimento. Tudo pronto; falta só conectar o WhatsApp.">
        <DataTable
          minWidth={760}
          head={
            <>
              <th>Situação</th>
              <th>Quando sai</th>
              <th className="text-right">Últimos 30 dias</th>
              <th className="text-right">Tempo à mão</th>
              <th>Tipo</th>
              <th className="text-right">Status</th>
            </>
          }
        >
          {volume.map((v) => {
            const info = SITUATIONS[v.situation];
            return (
              <tr key={v.situation}>
                <td className="font-semibold">{info.label}</td>
                <td className="text-[13px] text-muted">{info.when}</td>
                <td className="text-right">{formatInt(v.last30)}</td>
                <td className="text-right text-muted">{hours(v.last30 * info.manualMinutes)}</td>
                <td className="text-[13px]">{info.category === "utility" ? "Utilidade" : "Marketing"}</td>
                <td className="text-right">{info.defaultOn ? <Badge tone="ok">Pronta</Badge> : <Badge>Desligada</Badge>}</td>
              </tr>
            );
          })}
        </DataTable>
        <p className="border-t border-line-soft px-5 py-3 text-[13px] text-muted">
          Tempo à mão: de 1 a 3 minutos por mensagem para achar o contato, escrever e enviar. Na API oficial do WhatsApp, mensagens de marketing custam bem mais
          que as de utilidade, por isso os convites têm limite por dia.
        </p>
      </Panel>

      <Panel
        title="Fila de hoje"
        note="Mensagens montadas pelo assistente para hoje. Toque para abrir no WhatsApp e enviar."
        action={
          <nav aria-label="Filtrar por situação" className="no-scrollbar flex max-w-full gap-1 overflow-x-auto rounded-xl bg-chip p-1">
            <FilterLink href="/painel/whatsapp" active={!filter} label={`Todas · ${queue.length}`} />
            {SITUATION_ORDER.filter((k) => countBy.get(k)).map((k) => (
              <FilterLink key={k} href={`/painel/whatsapp?situacao=${k}`} active={filter === k} label={`${SITUATIONS[k].label} · ${countBy.get(k)}`} />
            ))}
          </nav>
        }
      >
        {shown.length ? (
          <ul className="flex flex-col divide-y divide-line-soft">
            {shown.slice(0, 40).map((i) => {
              const ready = i.sendAt <= s.now;
              return (
                <li key={i.id} className="flex flex-col gap-2.5 px-5 py-4 md:flex-row md:items-start md:gap-5">
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <Badge tone={SITUATIONS[i.situation].category === "marketing" ? "neutral" : "dark"}>{SITUATIONS[i.situation].label}</Badge>
                      <span className="font-semibold">Para {i.to.name}</span>
                      {i.about.id !== i.to.id ? <span className="text-muted">sobre {first(i.about.name)}</span> : null}
                      <span className={cn("text-[13px]", ready ? "font-semibold text-ok" : "text-muted")}>{ready ? "Pronta agora" : `Sai às ${timeOf(i.sendAt)}`}</span>
                    </div>
                    <MessageBubble text={i.text} />
                  </div>
                  <WhatsAppButton phone={i.to.phone} text={i.text} label="Enviar" className="self-start" track={{ kind: i.situation, customerId: i.about.id }} />
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty>Nenhuma mensagem nesta situação hoje.</Empty>
        )}
        {shown.length > 40 ? <p className="border-t border-line-soft px-5 py-3 text-[13px] text-muted">Mostrando 40 de {shown.length}. Filtre por situação para ver as outras.</p> : null}
      </Panel>
    </>
  );
}

function FilterLink({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn("flex h-9 shrink-0 items-center rounded-lg px-3 text-[13px] font-semibold whitespace-nowrap", active ? "bg-ink text-white" : "text-ink-soft hover:bg-white")}
    >
      {label}
    </Link>
  );
}
