"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { AlertTriangle, Check, Info, MapPin, Plus, UserRound } from "lucide-react";
import type { BookingUnit, BusyMap } from "@/domain/availability";
import {
  type BarberRef,
  type BookingMode,
  type PersonBooking,
  type Selection,
  availableStarts,
  decideBooking,
  previewChange,
  selectedUnit,
} from "@/domain/booking-rules";
import { formatMoney } from "@/domain/money";
import { priceFor } from "@/domain/pricing";
import { hhmm, shortDate, weekdayLong } from "@/domain/time";
import type { Plan, Service } from "@/domain/types";
import { issueMessage, type Names } from "@/components/booking-messages";
import { Eyebrow, buttonStyles, cn } from "@/components/ui";
import { bookAppointments, type BookingResult } from "./actions";

export interface BookingProps {
  people: { id: string; firstName: string; label: string; sub: string; plan: Plan | null }[];
  services: (Service & { main: boolean })[];
  barbers: BarberRef[];
  units: (BookingUnit & { name: string; address: string })[];
  busy: BusyMap;
  existing: PersonBooking[];
  preferredBarberId: string | null;
  days: { key: string; weekday: number; label: string; sub: string; closed: boolean }[];
  today: string;
  nowMinutes: number;
}

const DEFAULT_DURATION = 40;
const PREFS_KEY = "mb.booking.prefs";
const DRAFT_KEY = "mb.booking.draft";

interface Draft {
  who: string[];
  serviceIds: string[];
  sel: Selection;
  day: string;
  start: number | null;
}

/** A change that affects the current choice and needs the customer's OK. */
interface PendingChange {
  next: Selection;
  title: string;
  lines: string[];
  confirmLabel: string;
  cancelLabel: string;
  clearsTime: boolean;
}

function readJson<T>(storage: () => Storage, key: string): T | null {
  try {
    const raw = storage().getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(storage: () => Storage, key: string, value: unknown) {
  try {
    storage().setItem(key, JSON.stringify(value));
  } catch {
    /* private mode or storage blocked: the flow still works, it just won't be remembered */
  }
}

export function BookingFlow(p: BookingProps) {
  const defaultSel: Selection = p.preferredBarberId
    ? { mode: "professional", unitId: null, barberId: p.preferredBarberId }
    : { mode: "branch", unitId: p.units[0]?.id ?? null, barberId: null };
  const firstOpenDay = p.days.find((d) => !d.closed)?.key ?? p.today;

  const [who, setWho] = useState<string[]>([p.people[0]?.id].filter(Boolean) as string[]);
  const [serviceIds, setServiceIds] = useState<string[]>([]);
  const [sel, setSel] = useState<Selection>(defaultSel);
  const [day, setDay] = useState<string>(firstOpenDay);
  const [start, setStart] = useState<number | null>(null);
  const [showExtras, setShowExtras] = useState(false);
  const [showOtherUnits, setShowOtherUnits] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [pendingChange, setPendingChange] = useState<PendingChange | null>(null);
  const [result, setResult] = useState<BookingResult | null>(null);
  const [saving, startSaving] = useTransition();
  const [restored, setRestored] = useState(false);
  const changeRef = useRef<HTMLDivElement>(null);

  const unitName = (id: string | null) => p.units.find((u) => u.id === id)?.name ?? "";
  const barberName = (id: string) => p.barbers.find((b) => b.id === id)?.name ?? "";
  const names: Names = {
    barber: barberName,
    unit: (id) => unitName(id) || "escolhida",
    person: (id) => p.people.find((x) => x.id === id)?.firstName ?? "Essa pessoa",
  };

  // Restore the draft of this visit (back/forward, leaving and coming back) and the
  // customer's usual choice, keeping only what still exists.
  useEffect(() => {
    const valid = (s: Selection | undefined): s is Selection =>
      Boolean(s && (s.mode === "branch" || s.mode === "professional") && (!s.barberId || p.barbers.some((b) => b.id === s.barberId)) && (!s.unitId || p.units.some((u) => u.id === s.unitId)));
    const draft = readJson<Draft>(() => sessionStorage, DRAFT_KEY);
    const prefs = readJson<Selection>(() => localStorage, PREFS_KEY);
    if (draft) {
      const people = draft.who.filter((id) => p.people.some((x) => x.id === id));
      if (people.length) setWho(people);
      setServiceIds(draft.serviceIds.filter((id) => p.services.some((x) => x.id === id)));
      if (valid(draft.sel)) setSel(draft.sel);
      if (p.days.some((d) => d.key === draft.day && !d.closed)) {
        setDay(draft.day);
        setStart(draft.start);
      }
    } else if (valid(prefs ?? undefined) && !(prefs!.mode === "professional" && !prefs!.barberId)) {
      setSel(prefs!);
    }
    setRestored(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!restored) return;
    writeJson(() => sessionStorage, DRAFT_KEY, { who, serviceIds, sel, day, start } satisfies Draft);
    writeJson(() => localStorage, PREFS_KEY, sel);
  }, [restored, who, serviceIds, sel, day, start]);

  useEffect(() => {
    if (pendingChange) changeRef.current?.focus();
  }, [pendingChange]);

  const people = p.people.filter((x) => who.includes(x.id));
  const chosen = serviceIds.map((id) => p.services.find((s) => s.id === id)).filter((s): s is BookingProps["services"][number] => Boolean(s));
  const duration = chosen.length ? chosen.reduce((t, s) => t + s.durationMin, 0) : DEFAULT_DURATION;
  const dayInfo = p.days.find((d) => d.key === day) ?? p.days[0];

  const ctx = useMemo(
    () => ({
      customerIds: who,
      day,
      weekday: dayInfo.weekday,
      durationMin: duration,
      units: p.units,
      barbers: p.barbers,
      busy: p.busy,
      existing: p.existing,
      nowMinutes: day === p.today ? p.nowMinutes : null,
    }),
    [who, day, dayInfo.weekday, duration, p.units, p.barbers, p.busy, p.existing, p.today, p.nowMinutes],
  );

  const starts = useMemo(() => availableStarts({ ...ctx, sel }), [ctx, sel]);
  const decision = useMemo(() => (start !== null ? decideBooking({ ...ctx, sel, start }) : null), [ctx, sel, start]);

  /** Whether each professional has room for this booking (at the chosen time, or that day). */
  const barberOpen = useMemo(() => {
    const out: Record<string, boolean> = {};
    for (const b of p.barbers) {
      const s: Selection = { mode: "professional", unitId: null, barberId: b.id };
      out[b.id] = start !== null ? decideBooking({ ...ctx, sel: s, start }).ok : availableStarts({ ...ctx, sel: s }).length > 0;
    }
    return out;
  }, [ctx, start, p.barbers]);

  // A previously chosen time that stopped working (other services, people or day) is cleared.
  useEffect(() => {
    if (start !== null && decision && !decision.ok && decision.issues[0]?.code !== "person_busy" && !starts.includes(start)) setStart(null);
  }, [decision, start, starts]);

  const toggleWho = (id: string) => setWho((cur) => (cur.includes(id) ? (cur.length > 1 ? cur.filter((x) => x !== id) : cur) : [...cur, id]));
  const toggleService = (id: string) => setServiceIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  /** Applies a where/who change, asking first when it drops the professional or the time. */
  const requestChange = (next: Selection, opts: { reason?: string } = {}) => {
    setNotice(null);
    const impact = previewChange(sel, next, { ...ctx, start });
    const lines: string[] = [];
    if (opts.reason) lines.push(opts.reason);
    if (impact.dropsBarber) lines.push(`${barberName(impact.dropsBarber)} não atende na unidade ${unitName(impact.next.unitId)} e sai da seleção.`);
    if (impact.dropsTime && start !== null) lines.push(`O horário das ${hhmm(start)} não está livre com essa escolha. Você escolhe outro em seguida.`);
    if (lines.length && (impact.dropsBarber || impact.dropsTime || opts.reason)) {
      const toUnit = selectedUnit(impact.next, p.barbers);
      setPendingChange({
        next: impact.next,
        title: impact.unitChanged && toUnit ? `Trocar para a unidade ${unitName(toUnit)}?` : "Confirmar a troca?",
        lines,
        confirmLabel: impact.unitChanged && toUnit ? `Trocar para ${unitName(toUnit)}` : "Confirmar",
        cancelLabel: "Manter como estava",
        clearsTime: impact.dropsTime,
      });
      return;
    }
    setSel(impact.next);
    if (impact.unitChanged?.to && impact.unitChanged.from !== null) setNotice(`Agora na unidade ${unitName(impact.unitChanged.to)}. Os horários abaixo já são de lá.`);
  };

  const applyPending = () => {
    if (!pendingChange) return;
    setSel(pendingChange.next);
    if (pendingChange.clearsTime) setStart(null);
    const unit = selectedUnit(pendingChange.next, p.barbers);
    setNotice(unit ? `Agora na unidade ${unitName(unit)}.${pendingChange.clearsTime ? " Escolha um novo horário." : ""}` : null);
    setPendingChange(null);
  };

  const chooseMode = (mode: BookingMode) => {
    if (mode === sel.mode) return;
    if (mode === "professional") {
      const barberId = sel.barberId ?? (p.preferredBarberId && (!sel.unitId || p.barbers.find((b) => b.id === p.preferredBarberId)?.unitId === sel.unitId) ? p.preferredBarberId : null);
      requestChange({ mode, unitId: null, barberId });
    } else {
      const unitId = sel.barberId ? (p.barbers.find((b) => b.id === sel.barberId)?.unitId ?? null) : (sel.unitId ?? p.units[0]?.id ?? null);
      requestChange({ mode, unitId, barberId: sel.barberId });
    }
  };

  const chooseUnit = (unitId: string | null) => requestChange({ ...sel, mode: "branch", unitId });

  const chooseBarberInBranch = (barberId: string | null) => {
    if (!barberId) return requestChange({ ...sel, barberId: null });
    const barber = p.barbers.find((b) => b.id === barberId)!;
    if (sel.unitId && barber.unitId !== sel.unitId) {
      // Cross-unit pick while booking by unit: explain and offer to move the booking.
      return requestChange(
        { mode: "branch", unitId: barber.unitId, barberId },
        { reason: `${barber.name} atende na unidade ${unitName(barber.unitId)}. Você estava agendando na ${unitName(sel.unitId)}.` },
      );
    }
    requestChange({ ...sel, barberId });
  };

  const chooseBarber = (barberId: string) => {
    const barber = p.barbers.find((b) => b.id === barberId)!;
    const current = selectedUnit(sel, p.barbers);
    const reason = current && current !== barber.unitId && start !== null ? `${barber.name} atende na unidade ${unitName(barber.unitId)}.` : undefined;
    requestChange({ mode: "professional", unitId: null, barberId }, { reason: reason && previewChange(sel, { mode: "professional", unitId: null, barberId }, { ...ctx, start }).dropsTime ? reason : undefined });
  };

  const unit = selectedUnit(sel, p.barbers);
  const issues = decision && !decision.ok ? decision.issues : [];
  const canConfirm = chosen.length > 0 && people.length > 0 && start !== null && Boolean(decision?.ok) && !pendingChange;
  const dayBookings = p.existing.filter((b) => b.day === day && who.includes(b.customerId));

  const confirm = () => {
    if (!canConfirm) return;
    startSaving(async () => {
      const res = await bookAppointments({ customerIds: who, serviceIds, mode: sel.mode, unitId: sel.unitId, barberId: sel.barberId, day, start: start! });
      setResult(res);
      if (res.ok) {
        try {
          sessionStorage.removeItem(DRAFT_KEY);
        } catch {
          /* ignore */
        }
      }
    });
  };

  if (result?.ok) {
    const [d, t] = result.when.split("T");
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-5 px-6 pt-12 text-center">
        <span className="flex size-[72px] items-center justify-center rounded-full bg-ink text-white">
          <Check size={34} strokeWidth={2.4} aria-hidden="true" />
        </span>
        <h1 className="font-display text-[30px] font-semibold">{result.people.length > 1 ? "Agendados" : "Agendado"}</h1>
        <p className="text-[15px] text-muted first-letter:uppercase">
          {weekdayLong(d)}, {shortDate(d)} às {t} · unidade {result.unitName}
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

  const barbersByUnit = p.units.map((u) => ({ unit: u, barbers: p.barbers.filter((b) => b.unitId === u.id) }));
  const branchBarbers = sel.unitId ? p.barbers.filter((b) => b.unitId === sel.unitId) : p.barbers;
  const otherUnitBarbers = sel.unitId ? p.barbers.filter((b) => b.unitId !== sel.unitId) : [];

  return (
    <div className="px-5 pt-5 md:px-0 md:pt-8 lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start lg:gap-10">
      <div className="flex flex-col gap-7">
        <h1 className="font-display text-[28px] font-semibold md:text-[36px]">Agendar</h1>

        <section className="flex flex-col gap-2.5" aria-labelledby="h-who">
          <Eyebrow>
            <span id="h-who">Para quem?</span>
          </Eyebrow>
          <div className="flex flex-wrap gap-2">
            {p.people.map((x) => {
              const on = who.includes(x.id);
              return (
                <button
                  key={x.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleWho(x.id)}
                  className={cn("flex min-h-11 flex-col items-start justify-center rounded-full border-[1.5px] border-ink px-4 py-1.5", on ? "bg-ink text-white" : "bg-white")}
                >
                  <span className="text-sm font-semibold">{x.label}</span>
                  <span className="text-[11px] opacity-80">{x.sub}</span>
                </button>
              );
            })}
            <Link href="/conta#familia" className="flex min-h-11 items-center gap-1 rounded-full border-[1.5px] border-dashed border-[#9a9a9a] px-4 text-sm text-ink-soft">
              <Plus size={16} aria-hidden="true" /> Adicionar
            </Link>
          </div>
          <p className="text-[13px] text-ink-soft">
            {people.length > 1
              ? `${people.map((x) => x.firstName).join(", ").replace(/, ([^,]*)$/, " e $1")} no mesmo horário, lado a lado na mesma unidade.`
              : people[0]?.label === "Eu"
                ? "Só para você."
                : `Só para ${people[0]?.firstName}, na sua conta.`}
          </p>
        </section>

        <Step n={1} title="Serviço">
          <div className="grid gap-2 md:grid-cols-2">
            {p.services
              .filter((s) => s.main || showExtras || serviceIds.includes(s.id))
              .map((s) => {
                const on = serviceIds.includes(s.id);
                const coveredForAll = people.length > 0 && people.every((x) => x.plan && s.coverage && x.plan.covers.includes(s.coverage));
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleService(s.id)}
                    aria-pressed={on}
                    className={cn("flex min-h-14 items-center gap-3 rounded-2xl border-[1.5px] bg-white px-4 py-2.5 text-left", on ? "border-ink" : "border-line")}
                  >
                    <span className={cn("flex size-5 shrink-0 items-center justify-center rounded-md border-[1.5px] border-ink", on && "bg-ink text-white")}>
                      {on ? <Check size={14} strokeWidth={3} aria-hidden="true" /> : null}
                    </span>
                    <span className="flex flex-1 flex-col">
                      <span className="text-[15px] font-semibold">{s.name}</span>
                      <span className="text-xs text-muted">{s.durationMin} min</span>
                    </span>
                    <span className="text-right text-[13px] font-semibold">{coveredForAll ? "No clube" : formatMoney(s.priceCents)}</span>
                  </button>
                );
              })}
            <button type="button" onClick={() => setShowExtras((v) => !v)} className={cn(buttonStyles.ghost, "self-start text-muted md:col-span-2")}>
              {showExtras ? "Mostrar só os principais" : "Ver todos os serviços"}
            </button>
          </div>
        </Step>

        <Step n={2} title="Onde e com quem">
          <div role="radiogroup" aria-label="Como você prefere agendar" className="grid gap-3 sm:grid-cols-2">
            <ModeCard
              selected={sel.mode === "branch"}
              onSelect={() => chooseMode("branch")}
              Icon={MapPin}
              title="Por unidade"
              text="Escolha a unidade. Atende quem estiver livre lá, ou você escolhe alguém da equipe dessa unidade."
            />
            <ModeCard
              selected={sel.mode === "professional"}
              onSelect={() => chooseMode("professional")}
              Icon={UserRound}
              title="Por profissional"
              text="Escolha quem vai te atender. O agendamento fica na unidade onde essa pessoa trabalha."
            />
          </div>

          {pendingChange ? (
            <div ref={changeRef} tabIndex={-1} role="alertdialog" aria-labelledby="change-title" className="flex flex-col gap-3 rounded-2xl border-2 border-ink bg-white p-4 outline-none">
              <p id="change-title" className="flex items-center gap-2 font-semibold">
                <AlertTriangle size={18} aria-hidden="true" /> {pendingChange.title}
              </p>
              <ul className="flex flex-col gap-1 text-sm text-ink-soft">
                {pendingChange.lines.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button type="button" onClick={applyPending} className={cn(buttonStyles.primary, "min-h-11 flex-1 text-sm")}>
                  {pendingChange.confirmLabel}
                </button>
                <button type="button" onClick={() => setPendingChange(null)} className={cn(buttonStyles.secondary, "min-h-11 flex-1 text-sm")}>
                  {pendingChange.cancelLabel}
                </button>
              </div>
            </div>
          ) : null}

          {notice && !pendingChange ? (
            <p role="status" className="flex items-start gap-2 rounded-xl bg-chip p-3 text-[13px] text-ink-soft">
              <Info size={16} className="mt-px shrink-0" aria-hidden="true" /> {notice}
            </p>
          ) : null}

          {sel.mode === "branch" ? (
            <div className="flex flex-col gap-4">
              <div role="radiogroup" aria-label="Unidade" className="grid gap-2 sm:grid-cols-3">
                {p.units.map((u) => (
                  <OptionCard key={u.id} selected={sel.unitId === u.id} onSelect={() => chooseUnit(u.id)} title={u.name} sub={u.address} />
                ))}
                <OptionCard selected={sel.unitId === null} onSelect={() => chooseUnit(null)} title="Qualquer unidade" sub="O primeiro horário livre nas duas" />
              </div>
              <div className="flex flex-col gap-2">
                <p className="text-[13px] font-semibold text-ink-soft">Profissional {sel.unitId ? `da unidade ${unitName(sel.unitId)}` : ""} (opcional)</p>
                <div className="no-scrollbar -mx-5 flex gap-3 overflow-x-auto px-5 pb-1 md:mx-0 md:flex-wrap md:px-0">
                  <BarberChip name="Sem preferência" initials="?" selected={sel.barberId === null} onClick={() => chooseBarberInBranch(null)} />
                  {branchBarbers.map((b) => (
                    <BarberChip
                      key={b.id}
                      name={b.name}
                      initials={b.name.slice(0, 1)}
                      sub={sel.unitId ? undefined : unitName(b.unitId)}
                      badge={b.id === p.preferredBarberId ? "De sempre" : undefined}
                      selected={sel.barberId === b.id}
                      unavailable={!barberOpen[b.id]}
                      onClick={() => chooseBarberInBranch(b.id)}
                    />
                  ))}
                </div>
                {otherUnitBarbers.length ? (
                  <div className="flex flex-col gap-2">
                    <button type="button" aria-expanded={showOtherUnits} onClick={() => setShowOtherUnits((v) => !v)} className={cn(buttonStyles.ghost, "self-start px-0 text-[13px] text-muted underline-offset-2 hover:underline")}>
                      {showOtherUnits ? "Esconder profissionais de outras unidades" : "Procura alguém de outra unidade?"}
                    </button>
                    {showOtherUnits ? (
                      <div className="no-scrollbar -mx-5 flex gap-3 overflow-x-auto px-5 pb-1 md:mx-0 md:flex-wrap md:px-0">
                        {otherUnitBarbers.map((b) => (
                          <BarberChip
                            key={b.id}
                            name={b.name}
                            initials={b.name.slice(0, 1)}
                            sub={unitName(b.unitId)}
                            badge={b.id === p.preferredBarberId ? "De sempre" : undefined}
                            selected={false}
                            unavailable={!barberOpen[b.id]}
                            onClick={() => chooseBarberInBranch(b.id)}
                          />
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {barbersByUnit.map(({ unit: u, barbers }) => (
                <div key={u.id} className="flex flex-col gap-2">
                  <p className="text-[13px] font-semibold text-ink-soft">Unidade {u.name}</p>
                  <div className="no-scrollbar -mx-5 flex gap-3 overflow-x-auto px-5 pb-1 md:mx-0 md:flex-wrap md:px-0">
                    {barbers.map((b) => (
                      <BarberChip
                        key={b.id}
                        name={b.name}
                        initials={b.name.slice(0, 1)}
                        badge={b.id === p.preferredBarberId ? "De sempre" : undefined}
                        selected={sel.barberId === b.id}
                        unavailable={!barberOpen[b.id]}
                        onClick={() => chooseBarber(b.id)}
                      />
                    ))}
                  </div>
                </div>
              ))}
              {!sel.barberId ? <p className="text-[13px] text-muted">Escolha quem vai atender para ver os horários.</p> : null}
            </div>
          )}
        </Step>

        <Step n={3} title="Dia e horário" hint={people.length > 1 ? `Horários com ${people.length} cadeiras livres lado a lado` : unit ? `Horários livres na unidade ${unitName(unit)}` : "Horários livres nas duas unidades"}>
          <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5 md:mx-0 md:flex-wrap md:px-0">
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
          {dayBookings.length ? (
            <p className="flex items-start gap-2 text-[13px] text-ink-soft">
              <Info size={16} className="mt-px shrink-0" aria-hidden="true" />
              {dayBookings.map((b) => `${names.person(b.customerId)} já tem horário às ${hhmm(b.start)} (unidade ${unitName(b.unitId)})`).join(" · ")}. Esses horários não aparecem.
            </p>
          ) : null}
          {sel.mode === "professional" && !sel.barberId ? null : starts.length ? (
            <div className="grid grid-cols-4 gap-2 md:grid-cols-6">
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
            <p className="rounded-xl bg-chip p-4 text-sm text-muted">
              Sem horários livres nesse dia para essa escolha. Tente outro dia{sel.mode === "professional" ? ", outro profissional" : sel.unitId ? ", outra unidade" : ""}.
            </p>
          )}
        </Step>
      </div>

      <aside className="sticky bottom-[68px] -mx-5 mt-6 flex flex-col gap-2 border-t border-line bg-white px-5 pt-3 pb-4 md:bottom-0 md:mx-0 lg:top-24 lg:bottom-auto lg:mt-0 lg:gap-3 lg:rounded-2xl lg:border lg:p-5">
        <h2 className="hidden font-display text-lg font-semibold lg:block">Resumo</h2>
        <dl className="hidden gap-1.5 text-sm lg:grid lg:grid-cols-[auto_1fr] lg:gap-x-4">
          <dt className="text-muted">Quem</dt>
          <dd>{people.map((x) => x.firstName).join(", ")}</dd>
          <dt className="text-muted">Serviço</dt>
          <dd>{chosen.length ? chosen.map((s) => s.name).join(" + ") : "—"}</dd>
          <dt className="text-muted">Unidade</dt>
          <dd>{unit ? unitName(unit) : start !== null && decision?.ok ? unitName(decision.unitId) : "A primeira com horário livre"}</dd>
          <dt className="text-muted">Profissional</dt>
          <dd>{sel.barberId ? barberName(sel.barberId) : "Quem estiver livre"}</dd>
          <dt className="text-muted">Quando</dt>
          <dd className="first-letter:uppercase">{start !== null ? `${dayInfo.label === "Hoje" || dayInfo.label === "Amanhã" ? dayInfo.label.toLowerCase() : dayInfo.sub} às ${hhmm(start)}` : "—"}</dd>
        </dl>
        <p className="text-[13px] text-ink-soft lg:hidden">
          {[chosen.map((s) => s.name).join(" + "), sel.barberId ? barberName(sel.barberId) : unit ? unitName(unit) : null, start !== null ? `${dayInfo.label === "Hoje" || dayInfo.label === "Amanhã" ? dayInfo.label.toLowerCase() : dayInfo.sub} ${hhmm(start)}` : null]
            .filter(Boolean)
            .join(" · ") || "Escolha o serviço, onde e o horário."}
        </p>
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
        {issues.length ? (
          <p role="alert" className="text-[13px] font-semibold text-bad">
            {issueMessage(issues[0], names)}
          </p>
        ) : null}
        {result && !result.ok ? (
          <p role="alert" className="text-[13px] font-semibold text-bad">
            {result.error}
          </p>
        ) : null}
        <button type="button" onClick={confirm} disabled={!canConfirm || saving} className={buttonStyles.primary}>
          {saving
            ? "Agendando…"
            : pendingChange
              ? "Responda à pergunta acima"
              : canConfirm
              ? people.length > 1
                ? `Confirmar ${people.length} agendamentos`
                : "Confirmar agendamento"
              : !chosen.length
                ? "Escolha o serviço"
                : sel.mode === "professional" && !sel.barberId
                  ? "Escolha o profissional"
                  : "Escolha o horário"}
        </button>
      </aside>
    </div>
  );
}

function Step({ n, title, hint, children }: { n: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3" aria-label={title}>
      <div className="flex items-center gap-2.5">
        <span className="flex size-6 items-center justify-center rounded-full bg-ink font-display text-[13px] text-white">{n}</span>
        <h2 className="font-display text-lg font-semibold">{title}</h2>
      </div>
      {hint ? <p className="-mt-1.5 text-[13px] text-muted">{hint}</p> : null}
      {children}
    </section>
  );
}

function ModeCard(props: { selected: boolean; onSelect: () => void; Icon: typeof MapPin; title: string; text: string }) {
  const { Icon } = props;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={props.selected}
      onClick={props.onSelect}
      className={cn("flex min-h-24 items-start gap-3 rounded-2xl border-2 p-4 text-left transition-colors", props.selected ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink")}
    >
      <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-full", props.selected ? "bg-white text-ink" : "bg-chip")}>
        <Icon size={19} aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-center justify-between gap-2 text-[15px] font-semibold">
          {props.title}
          {props.selected ? <Check size={18} strokeWidth={2.6} aria-hidden="true" /> : null}
        </span>
        <span className={cn("text-[13px] leading-snug", props.selected ? "text-[#e0e0e0]" : "text-muted")}>{props.text}</span>
      </span>
    </button>
  );
}

function OptionCard(props: { selected: boolean; onSelect: () => void; title: string; sub: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={props.selected}
      onClick={props.onSelect}
      className={cn("flex min-h-14 flex-col justify-center rounded-xl border-[1.5px] px-4 py-2.5 text-left", props.selected ? "border-ink bg-chip" : "border-line bg-white hover:border-ink")}
    >
      <span className="flex items-center justify-between gap-2 text-sm font-semibold">
        {props.title}
        {props.selected ? <Check size={16} strokeWidth={2.6} aria-hidden="true" /> : null}
      </span>
      <span className="text-xs text-muted">{props.sub}</span>
    </button>
  );
}

function BarberChip(props: { name: string; initials: string; sub?: string; badge?: string; selected: boolean; unavailable?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      aria-pressed={props.selected}
      aria-label={`${props.name}${props.sub ? `, unidade ${props.sub}` : ""}${props.unavailable ? ", sem horário livre para essa escolha" : ""}`}
      className={cn("flex w-[78px] shrink-0 flex-col items-center gap-1.5", props.unavailable && !props.selected && "opacity-45")}
    >
      <span className={cn("relative flex size-[60px] items-center justify-center rounded-full border-[1.5px] border-ink font-display text-xl", props.selected ? "bg-ink text-white" : "bg-white")}>
        {props.initials}
        {props.badge ? <span className="absolute -bottom-1 rounded-md bg-ink px-1.5 py-px text-[9px] font-semibold tracking-normal text-white normal-case ring-2 ring-white">{props.badge}</span> : null}
      </span>
      <span className="text-center text-xs leading-tight font-semibold">{props.name}</span>
      {props.sub ? <span className="text-center text-[10px] leading-tight text-muted">{props.sub}</span> : null}
    </button>
  );
}
