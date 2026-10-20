import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, ChevronRight, Crown, Gift, Images, MapPin, MessageCircle, Scissors, Star } from "lucide-react";
import { Badge, Card, Eyebrow, Meter, SectionTitle, buttonStyles, cn } from "@/components/ui";
import { Photo } from "@/components/photo";
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
  const topProducts = productStats(s, { from: addDays(today, -60), to: today })
    .filter((p) => p.product.active)
    .slice(0, 4);

  return (
    <div className="flex flex-col gap-6 px-5 pt-5 md:gap-10 md:px-0 md:pt-8">
      {/* Web hero */}
      <section className="relative hidden overflow-hidden rounded-3xl bg-ink md:block">
        <Photo src={s.shop.coverPhotoUrl} alt="Interior da barbearia" className="absolute inset-0 h-full w-full opacity-45" fallback="" />
        <div className="relative flex min-h-[300px] flex-col justify-end gap-4 p-10 text-white">
          <p className="text-sm text-[#e0e0e0]">
            {greeting(s.now)}, {firstName(me.customer.name)}
          </p>
          <h1 className="max-w-xl font-display text-[44px] leading-[1.05] font-semibold">{s.shop.tagline}</h1>
          <div className="flex gap-3">
            <Link href="/agendar" className={buttonStyles.inverse}>
              Agendar horário
            </Link>
            <Link href="/clube" className={cn(buttonStyles.secondary, "border-white bg-transparent text-white hover:bg-white/10")}>
              Mister Club
            </Link>
          </div>
        </div>
      </section>

      <div className="md:hidden">
        <p className="text-sm text-muted">{greeting(s.now)},</p>
        <h1 className="font-display text-[32px] leading-tight font-semibold">{firstName(me.customer.name)}</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] md:gap-8">
        <div className="flex flex-col gap-4">
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
        </div>

        <div className="flex flex-col gap-4">
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

          <Link href="/indique" className="flex items-center gap-4 rounded-2xl bg-chip p-4 hover:bg-[#ebebeb]">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-ink text-white">
              <Gift size={20} aria-hidden="true" />
            </span>
            <span className="flex flex-1 flex-col">
              <span className="text-[15px] font-semibold">Indique e ganhe 50%</span>
              <span className="text-[13px] text-muted">
                {me.nextChargeDiscountCents > 0 ? `Sua próxima mensalidade já tem ${formatMoney(me.nextChargeDiscountCents)} de desconto` : "Cada amigo que assinar vale metade da sua próxima mensalidade"}
              </span>
            </span>
            <ChevronRight size={20} aria-hidden="true" />
          </Link>

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
        </div>
      </div>

      {s.shop.portfolio.length ? (
        <section className="flex flex-col gap-3">
          <SectionTitle>Resultados da semana</SectionTitle>
          <div className="no-scrollbar -mx-5 flex gap-3 overflow-x-auto px-5 pb-1 md:mx-0 md:grid md:grid-cols-4 md:overflow-visible md:px-0">
            {s.shop.portfolio.slice(0, 8).map((p, i) => (
              <figure key={p.url} className={cn("flex w-40 shrink-0 flex-col gap-1.5 md:w-auto", i >= 4 && "md:hidden")}>
                <Photo src={p.url} alt={p.caption} className="h-52 w-full rounded-2xl md:h-64" fallback="Foto do corte" />
                <figcaption>
                  <span className="block truncate text-[13px] font-semibold">{p.caption}</span>
                  {p.barberId ? <span className="text-xs text-muted">por {barberName(p.barberId, s.barbers)}</span> : null}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      ) : null}

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
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
            {topProducts.map(({ product }, i) => (
              <Link
                key={product.id}
                href={`/produtos#${product.id}`}
                className={cn("flex flex-col gap-2 rounded-2xl border border-line p-3 hover:border-ink", i >= 2 && "hidden md:flex")}
              >
                <Photo src={product.photoUrl} alt={product.name} className="h-28 w-full rounded-xl md:h-40" fallback="Produto" />
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
        <div className="grid gap-3 md:grid-cols-2 md:gap-4">
          {s.units.map((unit) => (
            <Card key={unit.id} className="flex flex-col gap-3 overflow-hidden p-0">
              <Photo src={unit.photoUrl} alt={`Unidade ${unit.name}`} className="h-36 w-full md:h-48" fallback="" />
              <div className="flex flex-col gap-3 px-4 pb-4">
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
              </div>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
