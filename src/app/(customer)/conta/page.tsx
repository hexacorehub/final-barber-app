import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Gift, Images } from "lucide-react";
import { appointmentWhen, barberName, serviceNames } from "@/components/format";
import { Badge, Card, Eyebrow, buttonStyles, cn } from "@/components/ui";
import { RELATIONSHIP_LABEL, household } from "@/domain/household";
import { customerSummary } from "@/domain/metrics";
import { formatMoney, formatMoneyRound } from "@/domain/money";
import { dayKey, shortDate } from "@/domain/time";
import { loadSnapshot } from "@/server/data/store";
import { currentCustomerId } from "@/server/session";
import { AccountControls } from "./account-controls";
import { AddMemberForm } from "./add-member-form";
import { AssistantTag } from "@/components/assistant";
import { familyNotes } from "@/domain/assistants/family";
import { maskCpf } from "@/domain/access";
import { customerLoginEnabled } from "@/server/customer-auth";
import { signOut } from "../../entrar/actions";

export const metadata: Metadata = { title: "Conta" };

const STATUS = { active: "Ativo", paused: "Pausado", past_due: "Pagamento pendente", canceled: "Cancelado" } as const;

export default async function AccountPage() {
  const s = await loadSnapshot();
  const meId = await currentCustomerId();
  const me = customerSummary(s, meId);
  if (!me) return <p className="p-5 text-sm text-muted">Cliente de demonstração não encontrado. Rode o seed do banco.</p>;
  const members = household(s, meId);
  const iAmHolder = members[0]?.customer.id === meId;
  const others = members.filter((m) => m.customer.id !== meId);
  const notes = iAmHolder ? familyNotes(s, meId) : [];
  const pendingPlan = (customerId: string) => {
    const lead = s.leads.find((l) => l.customerId === customerId && !s.subscriptions.some((x) => x.customerId === customerId && x.planId === l.planId && x.status !== "canceled"));
    return lead ? s.plans.find((p) => p.id === lead.planId) : undefined;
  };

  return (
    <div className="flex flex-col gap-6 px-5 pt-5 md:px-0 md:pt-8">
      <div>
        <h1 className="font-display text-[28px] font-semibold md:text-[36px]">Minha conta</h1>
        <p className="text-sm text-muted">
          {me.customer.name} · {me.customer.phone}
          {me.customer.cpf ? ` · CPF ${maskCpf(me.customer.cpf)}` : ""} · {iAmHolder ? "Titular" : "Conta gerenciada pelo titular"}
        </p>
        {customerLoginEnabled() ? (
          <form action={signOut} className="mt-2">
            <button type="submit" className="text-sm font-semibold underline">
              Sair da conta
            </button>
          </form>
        ) : null}
      </div>

      <div className="grid gap-6 md:grid-cols-2 md:gap-8">
        <div className="flex flex-col gap-6">
          {me.plan && me.subscription ? (
            <Card dark className="flex flex-col gap-3.5">
              <div className="flex items-center justify-between gap-3">
                <span className="font-display text-xl leading-tight">{me.plan.name.replace("Mister Club ", "")}</span>
                <Badge className="bg-white text-ink">{STATUS[me.subscription.status]}</Badge>
              </div>
              <Row label="Sua mensalidade" value={formatMoney(me.plan.priceCents)} />
              {me.dependents.length ? <Row label={`Total da conta (${me.dependents.length + 1} planos)`} value={formatMoney(me.monthlyTotalCents)} /> : null}
              {me.nextChargeDay ? (
                <Row
                  label="Próxima cobrança"
                  value={
                    me.nextChargeDiscountCents
                      ? `${shortDate(me.nextChargeDay)} · ${formatMoney(me.plan.priceCents - me.nextChargeDiscountCents)} (50% off)`
                      : shortDate(me.nextChargeDay)
                  }
                />
              ) : null}
              {me.savedLast12MonthsCents > 0 ? <Row label="Economia em 12 meses" value={formatMoneyRound(me.savedLast12MonthsCents)} /> : null}
            </Card>
          ) : (
            <Link href="/clube" className={buttonStyles.primary}>
              Conhecer o Mister Club
            </Link>
          )}

          {notes.length ? (
            <section className="flex flex-col gap-2.5" aria-label="Avisos da família">
              <div className="flex items-center gap-2">
                <Eyebrow>Avisos da conta</Eyebrow>
                <AssistantTag />
              </div>
              <ul className="flex flex-col gap-2">
                {notes.map((n) => (
                  <li key={`${n.kind}-${n.customer.id}`}>
                    <Link href={n.href} className="flex items-center gap-3 rounded-2xl bg-chip p-4 text-sm hover:bg-line">
                      <span className="flex-1">{n.text}</span>
                      <ChevronRight size={18} aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section id="familia" className="flex scroll-mt-24 flex-col gap-2.5">
            <Eyebrow>Família na conta</Eyebrow>
            {others.length === 0 ? <p className="text-sm text-muted">Adicione quem você quer gerenciar: cada pessoa pode ter o próprio plano, na sua cobrança.</p> : null}
            {others.map((m) => (
              <div key={m.customer.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-line p-4">
                <span className="flex size-10 items-center justify-center rounded-full bg-chip font-display">{m.customer.name.slice(0, 1)}</span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="flex flex-wrap items-center gap-1.5 font-semibold">
                    {m.customer.name.split(" ")[0]}
                    {m.customer.relationship ? <Badge>{RELATIONSHIP_LABEL[m.customer.relationship]}</Badge> : null}
                    {m.customer.minor ? <Badge>Menor</Badge> : null}
                  </span>
                  <span className="text-xs text-muted">{m.plan ? `${m.plan.name.replace("Mister Club ", "")} · ${formatMoney(m.plan.priceCents)}/mês` : "Sem plano"}</span>
                  {pendingPlan(m.customer.id) ? (
                    <span className="text-xs font-semibold text-ok">Pedido do {pendingPlan(m.customer.id)!.name.replace("Mister Club ", "")} em confirmação</span>
                  ) : null}
                </span>
                {iAmHolder ? (
                  <Link href={`/clube?para=${m.customer.id}`} className={cn(buttonStyles.secondary, "min-h-10 px-3 text-[13px]")}>
                    {m.plan ? "Trocar plano" : "Contratar plano"}
                  </Link>
                ) : null}
              </div>
            ))}
            {iAmHolder ? <AddMemberForm /> : null}
          </section>

          <Link href="/indique" className="flex items-center gap-4 rounded-2xl bg-chip p-4 hover:bg-[#ebebeb]">
            <Gift size={20} aria-hidden="true" />
            <span className="flex flex-1 flex-col">
              <span className="font-semibold">Indique e ganhe 50%</span>
              <span className="text-[13px] text-muted">Seu código: {me.customer.referralCode}</span>
            </span>
            <ChevronRight size={20} aria-hidden="true" />
          </Link>
        </div>

        <div className="flex flex-col gap-6">
          {me.subscription ? <AccountControls paused={me.subscription.status === "paused"} /> : null}

          {me.upcoming.length ? (
            <section className="flex flex-col gap-2.5">
              <Eyebrow>Próximos horários</Eyebrow>
              {me.upcoming.map((a) => (
                <div key={a.id} className="rounded-2xl border border-line p-4">
                  <p className="font-semibold first-letter:uppercase">{appointmentWhen(a, s.now)}</p>
                  <p className="text-sm text-muted">
                    {serviceNames(a.serviceIds, s.services)} com {barberName(a.barberId, s.barbers)}
                  </p>
                </div>
              ))}
            </section>
          ) : null}

          <Link href="/galeria" className="flex items-center gap-4 rounded-2xl border border-line p-4 hover:border-ink">
            <Images size={20} aria-hidden="true" />
            <span className="flex-1 font-semibold">Minha galeria</span>
            <ChevronRight size={20} aria-hidden="true" />
          </Link>

          <section className="flex flex-col gap-2.5">
            <Eyebrow>Últimas visitas</Eyebrow>
            <ul className="divide-y divide-line-soft rounded-2xl border border-line">
              {me.history.slice(0, 5).map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <span className="flex flex-col">
                    <span className="font-semibold">{serviceNames(a.serviceIds, s.services)}</span>
                    <span className="text-xs text-muted">
                      {shortDate(dayKey(a.startsAt))} · {barberName(a.barberId, s.barbers)}
                    </span>
                  </span>
                  <span className={cn("text-[13px]", a.chargedCents ? "font-semibold" : "text-muted")}>{a.chargedCents ? formatMoney(a.chargedCents) : "No clube"}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 text-sm text-[#d6d6d6]">
      <span>{label}</span>
      <span className="text-right font-semibold text-white">{value}</span>
    </div>
  );
}
