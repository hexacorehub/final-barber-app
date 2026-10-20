"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, MapPin, Plus } from "lucide-react";
import { type BookingUnit, type BusyMap, bookableStarts, planBooking } from "@/domain/availability";
import { formatMoney } from "@/domain/money";
import { priceFor } from "@/domain/pricing";
import { hhmm, shortDate, weekdayLong } from "@/domain/time";
import type { Plan, Service } from "@/domain/types";
import { Eyebrow, buttonStyles, cn } from "@/components/ui";
import { bookAppointments, type BookingResult } from "./actions";

export interface BookingProps {
  people: { id: string; firstName: string; label: string; sub: string; plan: Plan | null }[];
  services: (Service & { main: boolean })[];
  barbers: { id: string; name: string; unitId: string }[];
  units: (BookingUnit & { name: string })[];
  busy: BusyMap;
  days: { key: string; weekday: number; label: string; sub: string; closed: boolean }[];
  today: string;
  nowMinutes: number;
}

type Step = "service" | "barber" | "time";
const ORDERS: Record<Step, Step[]> = {
  service: ["service", "barber", "time"],
  barber: ["barber", "service", "time"],
  time: ["time", "service", "barber"],
};
const START_OPTIONS: { id: Step; label: string }[] = [
  { id: "service", label: "Serviço" },
  { id: "barber", label: "Profissional" },
  { id: "time", label: "Horário" },
];
const STEP_TITLE: Record<Step, string> = { service: "Serviço", barber: "Profissional", time: "Dia e horário" };
const DEFAULT_DURATION = 40;

export function BookingFlow(p: BookingProps) {
  const [who, setWho] = useState<string[]>([p.people[0]?.id].filter(Boolean) as string[]);
  const [startBy, setStartBy] = useState<Step>("service");
  const [unitId, setUnitId] = useState<string | null>(null);
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [barberId, setBarberId] = useState<string | null>(null);
  const [day, setDay] = useState<string>(p.days.find((d) => !d.closed)?.key ?? p.today);
  const [start, setStart] = useState<number | null>(null);
  const [showExtras, setShowExtras] = useState(false);
  const [result, setResult] = useState<BookingResult | null>(null);
  const [pending, startTransition] = useTransition();

  const people = p.people.filter((x) => who.includes(x.id));
  const chosen = serviceIds.map((id) => p.services.find((s) => s.id === id)!).filter(Boolean);
  const duration = chosen.length ? chosen.reduce((t, s) => t + s.durationMin, 0) : DEFAULT_DURATION;
  const dayInfo = p.days.find((d) => d.key === day)!;
  const barbersInScope = p.barbers.filter((b) => !unitId || b.unitId === unitId);

  const base = {
    units: p.units,
    unitId,
    day,
    weekday: dayInfo.weekday,
    durationMin: duration,
    people: Math.max(1, people.length),
    busy: p.busy,
    nowMinutes: day === p.today ? p.nowMinutes : null,
  };
  const starts = bookableStarts({ ...base, barberId });
  const assignment = start !== null ? planBooking({ ...base, barberId, start }) : null;

  const barberAvailable = (id: string) =>
    start !== null ? Boolean(planBooking({ ...base, barberId: id, start })) : bookableStarts({ ...base, barberId: id }).length > 0;

  const toggleWho = (id: string) => setWho((cur) => (cur.includes(id) ? (cur.length > 1 ? cur.filter((x) => x !== id) : cur) : [...cur, id]));
  const toggleService = (id: string) => setServiceIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
  const cycleUnit = () => {
    const ids = [null, ...p.units.map((u) => u.id)];
    const next = ids[(ids.indexOf(unitId) + 1) % ids.length];
    setUnitId(next);
    if (barberId && next && p.barbers.find((b) => b.id === barberId)?.unitId !== next) setBarberId(null);
  };

  const canConfirm = chosen.length > 0 && start !== null && assignment !== null && people.length > 0;
  const confirm = () => {
    if (!canConfirm) return;
    startTransition(async () => {
      setResult(await bookAppointments({ customerIds: who, serviceIds, unitId, barberId, day, start: start! }));
    });
  };

  if (result?.ok) {
    const [d, t] = result.when.split("T");
    return (
      <div className="flex flex-col items-center gap-5 px-6 pt-12 text-center">
        <span className="flex size-[72px] items-center justify-center rounded-full bg-ink text-white">
          <Check size={34} strokeWidth={2.4} aria-hidden="true" />
        </span>
        <h1 className="font-display text-[30px] font-semibold">{result.people.length > 1 ? "Agendados" : "Agendado"}</h1>
        <p className="text-[15px] text-muted first-letter:uppercase">
          {weekdayLong(d)}, {shortDate(d)} às {t} · {result.unitName}
        </p>
        <ul className="flex w-full flex-col gap-3 text-left">
          {result.people.map((x) => (
            <li key={x.name} className="rounded-2xl border border-line p-4">
              <p className="font-semibold">{x.name}</p>
              <p className="text-sm text-muted">
                {x.services} com {x.barber}
              </p>
              <p className="mt-1 text-sm font-semibold">{x.payment}</p>
            </li>
          ))}
        </ul>
        <p className="text-[13px] text-muted">Vamos te lembrar 2 horas antes pelo WhatsApp.</p>
        <Link href="/inicio" className={cn(buttonStyles.primary, "w-full")}>
          Voltar ao início
        </Link>
      </div>
    );
  }

  const sections: Record<Step, React.ReactNode> = {
    service: (
      <div className="flex flex-col gap-2">
        {p.services
          .filter((s) => s.main || showExtras)
          .map((s) => {
            const sel = serviceIds.includes(s.id);
            const coveredFor = people.filter((x) => x.plan && s.coverage && x.plan.covers.includes(s.coverage));
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => toggleService(s.id)}
                aria-pressed={sel}
                className={cn("flex min-h-14 items-center gap-3 rounded-2xl border-[1.5px] bg-white px-4 py-2.5 text-left", sel ? "border-ink" : "border-line")}
              >
                <span className={cn("flex size-5 shrink-0 items-center justify-center rounded-md border-[1.5px] border-ink", sel && "bg-ink text-white")}>
                  {sel ? <Check size={14} strokeWidth={3} aria-hidden="true" /> : null}
                </span>
                <span className="flex flex-1 flex-col">
                  <span className="text-[15px] font-semibold">{s.name}</span>
                  <span className="text-xs text-muted">{s.durationMin} min</span>
                </span>
                <span className="text-right text-[13px] font-semibold">
                  {coveredFor.length === people.length && people.length ? "No clube" : formatMoney(s.priceCents)}
                </span>
              </button>
            );
          })}
        <button type="button" onClick={() => setShowExtras((v) => !v)} className={cn(buttonStyles.ghost, "self-start text-muted")}>
          {showExtras ? "Mostrar só os principais" : "Ver todos os serviços"}
        </button>
      </div>
    ),
    barber: (
      <div className="no-scrollbar -mx-5 flex gap-3 overflow-x-auto px-5 pb-1">
        <BarberChip name="Sem preferência" initials="?" selected={barberId === null} onClick={() => setBarberId(null)} />
        {barbersInScope.map((b) => (
          <BarberChip
            key={b.id}
            name={b.name}
            initials={b.name.slice(0, 1)}
            unit={unitId ? undefined : p.units.find((u) => u.id === b.unitId)?.name}
            selected={barberId === b.id}
            disabled={!barberAvailable(b.id)}
            onClick={() => setBarberId(b.id)}
          />
        ))}
      </div>
    ),
    time: (
      <div className="flex flex-col gap-3">
        <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
          {p.days.map((d) => (
            <button
              key={d.key}
              type="button"
              disabled={d.closed}
              aria-pressed={day === d.key}
              onClick={() => {
                setDay(d.key);
                setStart(null);
              }}
              className={cn(
                "flex h-14 w-16 shrink-0 flex-col items-center justify-center rounded-xl border-[1.5px] text-[13px]",
                day === d.key ? "border-ink bg-ink text-white" : "border-ink bg-white",
                d.closed && "border-line text-faint",
              )}
            >
              <span className="font-semibold capitalize">{d.label}</span>
              <span className="text-[11px] opacity-80">{d.closed ? "fechado" : d.sub}</span>
            </button>
          ))}
        </div>
        {starts.length ? (
          <div className="grid grid-cols-4 gap-2">
            {starts.map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={start === t}
                onClick={() => setStart(t)}
                className={cn("h-11 rounded-xl border text-sm font-medium", start === t ? "border-ink bg-ink text-white" : "border-[#d4d4d4] bg-white")}
              >
                {hhmm(t)}
              </button>
            ))}
          </div>
        ) : (
          <p className="rounded-xl bg-chip p-4 text-sm text-muted">Sem horários livres nesse dia para essa escolha. Tente outro dia ou outro profissional.</p>
        )}
      </div>
    ),
  };

  const hints: Partial<Record<Step, string>> = {};
  if (startBy === "time") hints.barber = start !== null ? "Mostrando quem está livre no horário escolhido" : "Escolha um horário para ver quem está livre";
  if (startBy !== "time") hints.time = people.length > 1 ? `Horários com ${people.length} cadeiras livres lado a lado` : "Horários livres para o que você escolheu";

  const summary = [
    chosen.map((s) => s.name).join(" + "),
    barberId ? p.barbers.find((b) => b.id === barberId)?.name : null,
    start !== null ? `${dayInfo.label === "Hoje" || dayInfo.label === "Amanhã" ? dayInfo.label.toLowerCase() : dayInfo.sub} ${hhmm(start)}` : null,
  ].filter(Boolean);

  return (
    <div className="flex flex-col gap-6 px-5 pt-5">
      <h1 className="font-display text-[28px] font-semibold">Agendar</h1>

      <div className="flex flex-col gap-2.5">
        <Eyebrow>Para quem?</Eyebrow>
        <div className="flex flex-wrap gap-2">
          {p.people.map((x) => {
            const sel = who.includes(x.id);
            return (
              <button
                key={x.id}
                type="button"
                aria-pressed={sel}
                onClick={() => toggleWho(x.id)}
                className={cn("flex min-h-11 flex-col items-start justify-center rounded-full border-[1.5px] border-ink px-4 py-1.5", sel ? "bg-ink text-white" : "bg-white")}
              >
                <span className="text-sm font-semibold">{x.label}</span>
                <span className="text-[11px] opacity-80">{x.sub}</span>
              </button>
            );
          })}
          <Link href="/conta#dependentes" className="flex min-h-11 items-center gap-1 rounded-full border-[1.5px] border-dashed border-[#9a9a9a] px-4 text-sm text-ink-soft">
            <Plus size={16} aria-hidden="true" /> Adicionar
          </Link>
        </div>
        <p className="text-[13px] text-ink-soft">
          {people.length > 1 ? `${people.map((x) => x.firstName).join(" e ")} no mesmo horário, em cadeiras lado a lado.` : people[0]?.label === "Eu" ? "Só para você." : `Só para ${people[0]?.firstName}, na sua conta.`}
        </p>
      </div>

      <div className="flex flex-col gap-2.5">
        <Eyebrow>Começar por</Eyebrow>
        <div className="grid grid-cols-3 gap-1 rounded-xl bg-chip p-1">
          {START_OPTIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              aria-pressed={startBy === o.id}
              onClick={() => setStartBy(o.id)}
              className={cn("h-10 rounded-lg text-[13px] font-semibold", startBy === o.id ? "bg-ink text-white" : "text-ink-soft")}
            >
              {o.label}
            </button>
          ))}
        </div>
        <button type="button" onClick={cycleUnit} className="flex min-h-11 items-center justify-between rounded-xl border border-line px-4 text-sm">
          <span className="flex items-center gap-2">
            <MapPin size={17} aria-hidden="true" />
            {unitId ? `Unidade ${p.units.find((u) => u.id === unitId)?.name}` : "Qualquer unidade (a mais rápida)"}
          </span>
          <span className="text-[13px] text-muted">Trocar</span>
        </button>
      </div>

      {ORDERS[startBy].map((step, i) => (
        <section key={step} className="flex flex-col gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex size-6 items-center justify-center rounded-full bg-ink font-display text-[13px] text-white">{i + 1}</span>
            <h2 className="font-display text-lg font-semibold">{STEP_TITLE[step]}</h2>
          </div>
          {hints[step] ? <p className="-mt-1.5 text-[13px] text-muted">{hints[step]}</p> : null}
          {sections[step]}
        </section>
      ))}

      <div className="sticky bottom-[68px] -mx-5 flex flex-col gap-2.5 border-t border-line bg-white px-5 pt-3.5 pb-4">
        <p className="text-[13px] text-ink-soft">{summary.length ? summary.join(" · ") : "Nada escolhido ainda."}</p>
        {chosen.length && people.length ? (
          <p className="text-[13px] font-semibold">
            {people
              .map((x) => {
                const price = priceFor(serviceIds, p.services, x.plan);
                return `${x.firstName}: ${price.chargedCents === 0 ? "incluso no clube" : formatMoney(price.chargedCents)}`;
              })
              .join(" · ")}
          </p>
        ) : null}
        {result && !result.ok ? (
          <p role="alert" className="text-[13px] font-semibold text-bad">
            {result.error}
          </p>
        ) : null}
        {start !== null && !assignment ? <p className="text-[13px] text-bad">Esse horário não serve para essa escolha. Escolha outro.</p> : null}
        <button type="button" onClick={confirm} disabled={!canConfirm || pending} className={buttonStyles.primary}>
          {pending ? "Agendando…" : canConfirm ? (people.length > 1 ? `Confirmar ${people.length} agendamentos` : "Confirmar agendamento") : "Escolha serviço e horário"}
        </button>
      </div>
    </div>
  );
}

function BarberChip(props: { name: string; initials: string; unit?: string; selected: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      aria-pressed={props.selected}
      className="flex w-[76px] shrink-0 flex-col items-center gap-1.5 disabled:opacity-40"
    >
      <span
        className={cn(
          "flex size-[60px] items-center justify-center rounded-full border-[1.5px] border-ink font-display text-xl",
          props.selected ? "bg-ink text-white" : "bg-white",
        )}
      >
        {props.initials}
      </span>
      <span className="text-center text-xs leading-tight font-semibold">{props.name}</span>
      {props.unit ? <span className="text-center text-[10px] leading-tight text-muted">{props.unit}</span> : null}
    </button>
  );
}
