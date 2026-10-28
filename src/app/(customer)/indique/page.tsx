import type { Metadata } from "next";
import { headers } from "next/headers";
import { Card, Eyebrow } from "@/components/ui";
import { firstName } from "@/components/format";
import { customerSummary, referralSummary } from "@/domain/metrics";
import { CREDIT_LABEL, referralRulesText } from "@/domain/referral-rules";
import { formatMoney } from "@/domain/money";
import { shortDate } from "@/domain/time";
import { loadSnapshot } from "@/server/data/store";
import { currentCustomerId } from "@/server/session";
import { ShareButtons } from "./share-buttons";

export const metadata: Metadata = { title: "Indique e ganhe" };


export default async function ReferralPage() {
  const s = await loadSnapshot();
  const r = referralSummary(s, await currentCustomerId());
  if (!r) return <p className="p-5 text-sm text-muted">Cliente de demonstração não encontrado.</p>;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const link = `${proto}://${host}/convite/${r.code}`;
  const pct = Math.round(r.rules.discountPct * 100);
  const STEPS = [
    ["Compartilhe seu link", "Mande para amigos pelo WhatsApp ou copie o link."],
    ["O amigo assina o clube", "Ele escolhe o plano pelo app com o seu convite."],
    [`Você ganha ${pct}%`, "Quando a primeira mensalidade dele for paga, uma mensalidade sua sai pela metade."],
  ] as const;
  const mine = customerSummary(s, await currentCustomerId());
  const saved = mine && mine.plan && mine.savedLast12MonthsCents > 0 ? mine.savedLast12MonthsCents : 0;
  const message = saved
    ? `Eu assino o Mister Club da ${s.shop.name} e economizei ${formatMoney(saved).replace(/,00$/, "")} no último ano comparado a pagar cada corte. Assinando pelo meu convite eu ganho um desconto e você fica com o corte sempre em dia:`
    : `Bora pro Mister Club da ${s.shop.name}? Assinando pelo meu convite eu ganho um desconto e você fica com o corte sempre em dia:`;

  return (
    <div className="flex flex-col gap-6 px-5 pt-5 md:px-0 md:pt-8">
      <h1 className="font-display text-[28px] font-semibold md:text-[36px]">Indique e ganhe</h1>

      <div className="grid gap-6 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] md:gap-8">
        <div className="flex flex-col gap-6">
          {!r.canRefer ? (
            <p className="rounded-xl bg-chip p-4 text-sm text-ink-soft">Quem indica e recebe o desconto é o titular da conta, que paga os planos. Peça o código para ele.</p>
          ) : null}
          <Card dark className="flex flex-col gap-4 p-6">
            <p className="font-display text-[30px] leading-tight tracking-normal">
              {pct}% em uma
              <br />
              mensalidade sua
            </p>
            <p className="text-[15px] text-[#d6d6d6]">Para cada amigo que assinar o Mister Club com o seu convite.</p>
            <div className="flex flex-col gap-1 rounded-xl bg-[#1f1f1f] p-4">
              <span className="text-xs text-[#bdbdbd]">Seu código</span>
              <span className="font-display text-2xl tracking-[0.08em]">{r.code}</span>
            </div>
            <ShareButtons link={link} message={message} />
            {saved ? <p className="text-[13px] text-[#bdbdbd]">O convite já conta quanto você economizou no clube: {formatMoney(saved)} em 12 meses.</p> : null}
          </Card>

          <ol className="grid gap-3 sm:grid-cols-3">
            {STEPS.map(([title, text], i) => (
              <li key={title} className="flex flex-col gap-2 rounded-2xl border border-line p-4">
                <span className="flex size-7 items-center justify-center rounded-full bg-ink font-display text-sm text-white">{i + 1}</span>
                <span className="font-semibold">{title}</span>
                <span className="text-[13px] text-muted">{text}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="flex flex-col gap-4">
          {r.next ? (
            <div className="flex flex-col gap-1 rounded-2xl bg-ok-bg p-5 text-ok">
              <span className="text-sm">Próxima mensalidade · {shortDate(r.next.day)}</span>
              <span className="font-display text-[26px] tracking-normal">
                {formatMoney(r.next.priceCents - r.next.discountCents)} <s className="text-base text-ok/70">{formatMoney(r.next.priceCents)}</s>
              </span>
              <span className="text-sm">Desconto de {formatMoney(r.next.discountCents)} pela sua indicação.</span>
            </div>
          ) : null}
          {r.waiting > 0 ? <p className="rounded-xl bg-chip p-4 text-sm text-ink-soft">Mais {r.waiting} {r.waiting === 1 ? "desconto guardado" : "descontos guardados"} para as próximas mensalidades.</p> : null}
          {r.target ? (
            <p className="text-sm text-ink-soft">
              Os descontos vão para {r.target.forWhom.id === r.target.subscription.payerCustomerId && r.target.forWhom.id === r.target.subscription.customerId ? "o seu plano" : `o plano de ${firstName(r.target.forWhom.name)}`},{" "}
              {r.target.plan.name.replace("Mister Club ", "")} ({formatMoney(r.target.plan.priceCents)}). Um por mês, nunca em todos os planos da conta.
            </p>
          ) : (
            <p className="text-sm text-ink-soft">Você ainda não tem um plano: os descontos ficam guardados até você assinar.</p>
          )}

          <section className="flex flex-col gap-2.5">
            <Eyebrow>Amigos que assinaram</Eyebrow>
            {r.joined.length ? (
              <ul className="divide-y divide-line-soft rounded-2xl border border-line">
                {r.joined.map((j) => (
                  <li key={j.customer.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <span className="flex flex-col">
                      <span className="font-semibold">{firstName(j.customer.name)}</span>
                      <span className="text-xs text-muted">
                        {j.plan.name.replace("Mister Club ", "")} · desde {shortDate(j.since)}
                      </span>
                    </span>
                    <span className="text-right text-[13px]">
                      <span className={j.credit?.status === "applied" || j.credit?.status === "scheduled" || j.credit?.status === "queued" ? "font-semibold text-ok" : "text-muted"}>
                        {j.credit ? CREDIT_LABEL[j.credit.status] : "—"}
                      </span>
                      {j.credit?.usedOn ? <span className="block text-xs text-muted">mensalidade de {shortDate(j.credit.usedOn)}</span> : null}
                      {j.credit?.status === "queued" && j.credit.expiresOn ? <span className="block text-xs text-muted">vale até {shortDate(j.credit.expiresOn)}</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Ninguém ainda. O primeiro desconto está a um convite de distância.</p>
            )}
          </section>

          {r.pending.length ? (
            <section className="flex flex-col gap-2.5">
              <Eyebrow>Aguardando confirmação</Eyebrow>
              <ul className="divide-y divide-line-soft rounded-2xl border border-line">
                {r.pending.map((p) => (
                  <li key={p.customer.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <span className="font-semibold">{firstName(p.customer.name)}</span>
                    <span className="text-xs text-muted">pediu o {p.plan.name.replace("Mister Club ", "")}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {r.usedCents > 0 ? <p className="text-sm text-muted">Você já economizou {formatMoney(r.usedCents)} com indicações.</p> : null}
          <section className="flex flex-col gap-2 rounded-2xl border border-line p-4">
            <Eyebrow>Regras</Eyebrow>
            <ul className="flex list-disc flex-col gap-1 pl-4 text-[13px] text-ink-soft">
              {referralRulesText(r.rules).map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}
