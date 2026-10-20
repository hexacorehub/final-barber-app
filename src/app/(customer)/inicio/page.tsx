import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, ChevronRight, Crown, Images, MapPin, MessageCircle, Scissors, Star } from "lucide-react";
import { Badge, Card, Eyebrow, Meter, Placeholder, SectionTitle, buttonStyles, cn } from "@/components/ui";
import { appointmentWhen, barberName, firstName, greeting, hoursLabel, mapsUrl, serviceNames, whatsappUrl } from "@/components/format";
import { customerSummary, productStats } from "@/domain/metrics";
import { formatMoney, formatMoneyRound } from "@/domain/money";
import { addDays, dayKey } from "@/domain/time";
import { loadSnapshot } from "@/server/data/store";
import { currentCustomerId } from "@/server/session";

export const metadata: Metadata = { title: "Início" };

export default async function HomePage() {
  const s = await loadSnapshot();
  const me = customerSummary(s, await currentCustomerId());
  if (!me) return <p className="p-5 text-sm text-muted">Cliente de demonstração não encontrado. Rode o seed do banco.</p>;

  const today = dayKey(s.now);
  const next = me.upcoming[0];
  const cycle = me.customer.cycleDays;
  const since = me.daysSinceVisit;
  const dueIn = me.nextSuggested ? Math.round((Date.parse(me.nextSuggested) - Date.parse(today)) / 86_400_000) : null;

  const recent = s.appointments
    .filter((a) => a.status === "completed" && dayKey(a.startsAt) >= addDays(today, -7) && dayKey(a.startsAt) <= today)
    .slice(-4)
    .reverse();
  const topProducts = productStats(s, { from: addDays(today, -60), to: today })
    .filter((p) => p.product.active)
    .slice(0, 2);

  return (
    <div className="flex flex-col gap-6 px-5 pt-5">
      <div>
        <p className="text-sm text-muted">{greeting(s.now)},</p>
        <h1 className="font-display text-[32px] leading-tight font-semibold">{firstName(me.customer.name)}</h1>
      </div>

      {next ? (
        <Card className="flex items-center gap-4">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-ink text-white">
            <CalendarDays size={22} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <Eyebrow>Próximo horário</Eyebrow>
            <p className="font-semibold first-letter:uppercase">{appointmentWhen(next, s.now)}</p>
            <p className="truncate text-sm text-muted">
              {serviceNames(next.serviceIds, s.services)} com {barberName(next.barberId, s.barbers)}
            </p>
          </div>
        </Card>
      ) : null}

      {since !== null ? (
        <Card dark className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="font-display text-[13px] tracking-[0.14em]">Hora do próximo corte</span>
            <Scissors size={20} aria-hidden="true" />
          </div>
          <p className="text-[15px] leading-relaxed text-[#e8e8e8]">
            Seu último corte foi há <strong className="text-white">{since} dias</strong>. Você costuma voltar a cada {cycle}.
            {dueIn !== null && dueIn > 0 ? ` Faltam ${dueIn} ${dueIn === 1 ? "dia" : "dias"}.` : dueIn === 0 ? " É hoje." : " Já passou da hora."}
          </p>
          <Meter value={since / cycle} label="Dias desde o último corte" className="bg-[#3a3a3a] [&>div]:bg-white" />
          <Link href="/agendar" className={buttonStyles.inverse}>
            Agendar agora
          </Link>
        </Card>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <Link href="/agendar" className="flex flex-col gap-2.5 rounded-2xl border border-line p-4 hover:border-ink">
          <CalendarDays size={24} strokeWidth={1.8} aria-hidden="true" />
          <span className="text-[15px] font-semibold">Agendar</span>
          <span className="text-[13px] text-muted">Para você ou família</span>
        </Link>
        <Link href="/clube" className="flex flex-col gap-2.5 rounded-2xl border border-line p-4 hover:border-ink">
          <Crown size={24} strokeWidth={1.8} aria-hidden="true" />
          <span className="text-[15px] font-semibold">Mister Club</span>
          <span className="text-[13px] text-muted">{me.plan ? "Plano ativo" : "Conheça os planos"}</span>
        </Link>
      </div>

      {me.plan && me.savedLast12MonthsCents > 0 ? (
        <Link href="/conta" className="flex items-center justify-between gap-3 rounded-2xl border-[1.5px] border-dashed border-ink p-4">
          <span className="flex flex-col gap-1">
            <span className="text-[15px] font-semibold">Você economizou {formatMoneyRound(me.savedLast12MonthsCents)} com o clube</span>
            <span className="text-[13px] text-muted">Nos últimos 12 meses, comparado a pagar cada visita</span>
          </span>
          <ChevronRight size={20} aria-hidden="true" />
        </Link>
      ) : (
        <Link href="/clube#calculadora" className="flex items-center justify-between gap-3 rounded-2xl border-[1.5px] border-dashed border-ink p-4">
          <span className="flex flex-col gap-1">
            <span className="text-[15px] font-semibold">Quanto você economiza no clube?</span>
            <span className="text-[13px] text-muted">Calcule em 10 segundos com seus hábitos</span>
          </span>
          <ChevronRight size={20} aria-hidden="true" />
        </Link>
      )}

      {recent.length ? (
        <section className="flex flex-col gap-3">
          <SectionTitle>Resultados da semana</SectionTitle>
          <div className="no-scrollbar -mx-5 flex gap-3 overflow-x-auto px-5 pb-1">
            {recent.map((a) => (
              <div key={a.id} className="flex w-36 shrink-0 flex-col gap-1.5">
                <Placeholder label="Foto do corte" className="h-44" />
                <span className="truncate text-[13px] font-semibold">{serviceNames(a.serviceIds, s.services)}</span>
                <span className="text-xs text-muted">por {barberName(a.barberId, s.barbers)}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <Link href="/galeria" className="flex items-center gap-4 rounded-2xl border border-line p-4 hover:border-ink">
        <span className="flex size-11 items-center justify-center rounded-full bg-chip">
          <Images size={20} aria-hidden="true" />
        </span>
        <span className="flex flex-1 flex-col">
          <span className="text-[15px] font-semibold">Minha galeria</span>
          <span className="text-[13px] text-muted">Antes e depois de cada corte</span>
        </span>
        <ChevronRight size={20} aria-hidden="true" />
      </Link>

      {topProducts.length ? (
        <section className="flex flex-col gap-3">
          <SectionTitle
            action={
              <Link href="/produtos" className="text-[13px] text-muted underline-offset-2 hover:underline">
                Ver todos
              </Link>
            }
          >
            Mais vendidos na barbearia
          </SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            {topProducts.map(({ product }) => (
              <Link key={product.id} href={`/produtos#${product.id}`} className="flex flex-col gap-2 rounded-2xl border border-line p-3 hover:border-ink">
                <Placeholder label="Produto" className="h-24 rounded-xl" />
                <span className="text-[13px] leading-snug font-semibold">{product.name}</span>
                <span className="text-[13px] text-muted">{formatMoney(product.priceCents)}</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="flex flex-col gap-3 border-t border-line pt-5">
        <SectionTitle>A barbearia</SectionTitle>
        <p className="text-sm text-muted">{s.shop.tagline}</p>
        <div className="flex flex-wrap gap-2">
          <Badge>
            <Star size={12} className="mr-1" aria-hidden="true" /> {s.shop.ratingLabel}
          </Badge>
          <Badge>{s.shop.memberCountLabel}</Badge>
        </div>
        {s.units.map((unit) => (
          <Card key={unit.id} className="flex flex-col gap-3 p-4">
            <div>
              <p className="font-semibold">{unit.name}</p>
              <p className="text-sm text-muted">{unit.address}</p>
              <p className="mt-1 text-[13px] text-muted">{hoursLabel(unit).join(" · ")}</p>
            </div>
            <div className="flex gap-2">
              <a href={mapsUrl(unit)} target="_blank" rel="noreferrer" className={cn(buttonStyles.secondary, "min-h-11 flex-1 text-sm")}>
                <MapPin size={16} aria-hidden="true" /> Como chegar
              </a>
              {unit.phone ? (
                <a href={whatsappUrl(unit.phone)} target="_blank" rel="noreferrer" className={cn(buttonStyles.secondary, "min-h-11 flex-1 text-sm")}>
                  <MessageCircle size={16} aria-hidden="true" /> WhatsApp
                </a>
              ) : null}
            </div>
          </Card>
        ))}
      </section>
    </div>
  );
}
