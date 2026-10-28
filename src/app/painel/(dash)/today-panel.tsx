import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AssistantTag, WhatsAppButton } from "@/components/assistant";
import { Badge } from "@/components/ui";
import { MONTHS_AT_STAKE, type ActionKind, type OwnerDay } from "@/domain/assistants/owner-actions";
import { formatMoneyCompact, formatMoneyRound } from "@/domain/money";

const KIND: Record<ActionKind, { label: string; plural: string; tone: "bad" | "warn" | "ok" | "neutral" | "dark"; href: string }> = {
  card_declined: { label: "Cobrança", plural: "cartões recusados", tone: "bad", href: "/painel/assinaturas?status=risk" },
  member_late: { label: "Retenção", plural: "assinantes sumidos", tone: "warn", href: "/painel/assinaturas?status=risk" },
  offer_in_person: { label: "Oferta no balcão", plural: "ofertas no balcão", tone: "ok", href: "/painel/candidatos" },
  club_invite: { label: "Convite", plural: "convites para o clube", tone: "ok", href: "/painel/candidatos?chance=alta" },
  plan_request: { label: "Pedido", plural: "pedidos de plano", tone: "dark", href: "/painel/clube#interessados" },
  fill_gap: { label: "Encaixe", plural: "barbeiros com horário vago amanhã", tone: "neutral", href: "/painel/barbeiros#encaixe" },
  win_back: { label: "Reconquista", plural: "ex-assinantes para reconquistar", tone: "ok", href: "/painel/assinaturas?status=canceled" },
  low_stock: { label: "Estoque", plural: "produtos para repor", tone: "neutral", href: "/painel/produtos" },
};

const ORDER: ActionKind[] = ["card_declined", "plan_request", "offer_in_person", "club_invite", "win_back", "fill_gap", "member_late", "low_stock"];

/** The Gerente assistant on the overview: what to do today, by money involved. */
export function TodayPanel({ day, show = 5, showMoney = true, showMessages = true }: { day: OwnerDay; show?: number; showMoney?: boolean; showMessages?: boolean }) {
  const counts = new Map<ActionKind, number>();
  for (const a of day.actions) counts.set(a.kind, (counts.get(a.kind) ?? 0) + 1);
  // Always show variety: the top action of each kind first, then by value.
  const firstOfKind = ORDER.map((k) => day.actions.find((a) => a.kind === k)).filter((a) => a !== undefined);
  const top = [...firstOfKind.filter((a) => a.valueCents > 0), ...day.actions].filter((a, i, all) => all.findIndex((x) => x.id === a.id) === i).slice(0, show);

  return (
    <section className="flex min-w-0 flex-col rounded-2xl border-[1.5px] border-ink">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line-soft px-5 py-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-xl font-semibold">Hoje na barbearia</h2>
            <AssistantTag />
          </div>
          <p className="text-[13px] text-muted">
            {showMoney ? `O que fazer hoje, em ordem de valor. Assinaturas contam ${MONTHS_AT_STAKE} meses de mensalidade.` : "O que fazer hoje, em ordem de prioridade."}
          </p>
        </div>
        <div className={showMoney ? "flex gap-5 text-right" : "hidden"}>
          <div>
            <p className="text-[13px] text-muted">Para segurar</p>
            <p className="font-display text-2xl">{formatMoneyCompact(day.keepCents)}</p>
          </div>
          <div>
            <p className="text-[13px] text-muted">Para ganhar</p>
            <p className="font-display text-2xl">{formatMoneyCompact(day.winCents)}</p>
          </div>
        </div>
      </div>

      <ol className="flex flex-col divide-y divide-line-soft">
        {top.map((a) => (
          <li key={a.id} className="flex flex-col gap-2 px-5 py-3.5 md:flex-row md:items-center md:gap-4">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={KIND[a.kind].tone}>{KIND[a.kind].label}</Badge>
                <span className="text-[15px] font-semibold">{a.title}</span>
              </div>
              <p className="text-[13px] leading-relaxed text-muted">{a.reason}</p>
            </div>
            <div className="flex items-center gap-3 md:justify-end">
              {a.valueCents && showMoney ? <span className="text-sm font-semibold md:w-28 md:text-right">{formatMoneyRound(a.valueCents)}</span> : null}
              {a.message ? (
                <WhatsAppButton phone={a.message.to.phone} text={a.message.text} label="Mensagem" track={{ kind: a.kind, customerId: a.message.aboutId }} />
              ) : (
                <Link href={a.href} className="inline-flex min-h-10 items-center gap-1 rounded-lg px-3 text-[13px] font-semibold hover:bg-chip">
                  Ver <ArrowRight size={14} aria-hidden="true" />
                </Link>
              )}
            </div>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap gap-2 border-t border-line-soft px-5 py-3">
        {ORDER.filter((k) => counts.get(k)).map((k) => (
          <Link key={k} href={KIND[k].href} className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-chip px-3 text-[13px] hover:bg-line">
            <span className="font-semibold">{counts.get(k)}</span> {KIND[k].plural}
          </Link>
        ))}
        {showMessages ? (
          <Link href="/painel/whatsapp" className="ml-auto inline-flex min-h-9 items-center gap-1 text-[13px] font-semibold">
            Mensagens do dia <ArrowRight size={14} aria-hidden="true" />
          </Link>
        ) : null}
      </div>
    </section>
  );
}
