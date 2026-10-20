import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Images } from "lucide-react";
import { appointmentWhen, barberName, serviceNames } from "@/components/format";
import { Badge, Card, Eyebrow, buttonStyles, cn } from "@/components/ui";
import { customerSummary } from "@/domain/metrics";
import { formatMoney, formatMoneyRound } from "@/domain/money";
import { dayKey, shortDate } from "@/domain/time";
import { loadSnapshot } from "@/server/data/store";
import { currentCustomerId } from "@/server/session";
import { AccountControls } from "./account-controls";

export const metadata: Metadata = { title: "Conta" };

const STATUS = { active: "Ativo", paused: "Pausado", past_due: "Pagamento pendente", canceled: "Cancelado" } as const;

export default async function AccountPage() {
  const s = await loadSnapshot();
  const me = customerSummary(s, await currentCustomerId());
  if (!me) return <p className="p-5 text-sm text-muted">Cliente de demonstração não encontrado. Rode o seed do banco.</p>;

  return (
    <div className="flex flex-col gap-6 px-5 pt-5">
      <div>
        <h1 className="font-display text-[28px] font-semibold">Minha conta</h1>
        <p className="text-sm text-muted">
          {me.customer.name} · {me.customer.phone}
        </p>
      </div>

      {me.plan && me.subscription ? (
        <Card dark className="flex flex-col gap-3.5">
          <div className="flex items-center justify-between gap-3">
            <span className="font-display text-xl leading-tight">{me.plan.name.replace("Mister Club ", "")}</span>
            <Badge className="bg-white text-ink">{STATUS[me.subscription.status]}</Badge>
          </div>
          <Row label="Mensalidade" value={formatMoney(me.plan.priceCents)} />
          {me.dependents.length ? <Row label="Total com dependentes" value={formatMoney(me.monthlyTotalCents)} /> : null}
          {me.nextChargeDay ? <Row label="Próxima cobrança" value={shortDate(me.nextChargeDay)} /> : null}
          {me.savedLast12MonthsCents > 0 ? <Row label="Economia em 12 meses" value={formatMoneyRound(me.savedLast12MonthsCents)} /> : null}
        </Card>
      ) : (
        <Link href="/clube" className={buttonStyles.primary}>
          Conhecer o Mister Club
        </Link>
      )}

      <section id="dependentes" className="flex scroll-mt-20 flex-col gap-2.5">
        <Eyebrow>Dependentes</Eyebrow>
        {me.dependents.map((d) => (
          <div key={d.customer.id} className="flex items-center gap-3 rounded-2xl border border-line p-4">
            <span className="flex size-10 items-center justify-center rounded-full bg-chip font-display">{d.customer.name.slice(0, 1)}</span>
            <span className="flex flex-1 flex-col">
              <span className="font-semibold">{d.customer.name.split(" ")[0]}</span>
              <span className="text-xs text-muted">
                {d.plan.name.replace("Mister Club ", "")} · {formatMoney(d.plan.priceCents)}/mês · na sua cobrança
              </span>
            </span>
          </div>
        ))}
        <Link href="/clube" className="flex min-h-11 items-center justify-center rounded-xl border-[1.5px] border-dashed border-[#9a9a9a] text-sm text-ink-soft">
          + Adicionar dependente (filho, parceiro)
        </Link>
      </section>

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
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm text-[#d6d6d6]">
      <span>{label}</span>
      <span className="font-semibold text-white">{value}</span>
    </div>
  );
}
