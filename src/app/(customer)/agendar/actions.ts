"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { decideBooking } from "@/domain/booking-rules";
import { addDays, dayKey, fromLocal, hhmm, localParts, weekdayOf } from "@/domain/time";
import { issueMessage } from "@/components/booking-messages";
import { BOOKING_DAYS, bookablePeople, bookingUnits, busyMap, personBookings, priceFor } from "@/server/booking";
import { getStore, loadFreshSnapshot } from "@/server/data/store";
import { canSeeApp } from "@/server/demo-access";
import { currentCustomerId } from "@/server/session";

const Input = z.object({
  customerIds: z.array(z.string()).min(1).max(8),
  serviceIds: z.array(z.string()).min(1).max(4),
  mode: z.enum(["branch", "professional"]),
  unitId: z.string().nullable(),
  barberId: z.string().nullable(),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start: z.number().int().min(0).max(24 * 60),
});

export type BookingInput = z.infer<typeof Input>;

export type BookingResult =
  | { ok: true; when: string; startsAt: string; durationMin: number; unitName: string; unitAddress: string; shopName: string; people: { name: string; barber: string; services: string; payment: string }[] }
  | { ok: false; error: string };

/**
 * Saves the booking after checking everything again on fresh data: who may be booked, the
 * services, the day, the unit/professional rules, double bookings and free chairs.
 */
export async function bookAppointments(raw: BookingInput): Promise<BookingResult> {
  if (!(await canSeeApp())) return { ok: false, error: "Acesso de demonstração expirado. Entre de novo." };
  const parsed = Input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Escolha quem vai, o serviço e um horário." };
  const input = parsed.data;

  const s = await loadFreshSnapshot();
  const me = await currentCustomerId();
  const people = bookablePeople(s, me).filter((p) => input.customerIds.includes(p.id));
  if (people.length !== new Set(input.customerIds).size) return { ok: false, error: "Só é possível agendar para você e para as pessoas da sua conta." };

  const services = input.serviceIds.map((id) => s.services.find((x) => x.id === id && x.bookable));
  if (services.some((x) => !x)) return { ok: false, error: "Um dos serviços escolhidos não está disponível." };

  const today = dayKey(s.now);
  if (input.day < today || input.day > addDays(today, BOOKING_DAYS)) return { ok: false, error: "Escolha um dia dentro da próxima semana." };

  const barbers = s.barbers.filter((b) => b.active).map((b) => ({ id: b.id, name: b.name, unitId: b.unitId }));
  const durationMin = services.reduce((t, x) => t + x!.durationMin, 0);
  const decision = decideBooking({
    sel: { mode: input.mode, unitId: input.unitId, barberId: input.barberId },
    customerIds: people.map((p) => p.id),
    day: input.day,
    weekday: weekdayOf(input.day),
    start: input.start,
    durationMin,
    units: bookingUnits(s),
    barbers,
    busy: busyMap(s),
    existing: personBookings(s, people.map((p) => p.id)),
    nowMinutes: input.day === today ? localParts(s.now).minutes : null,
  });
  if (!decision.ok) {
    const names = {
      barber: (id: string) => s.barbers.find((b) => b.id === id)?.name ?? "O profissional",
      unit: (id: string | null) => s.units.find((u) => u.id === id)?.name ?? "escolhida",
      person: (id: string) => people.find((p) => p.id === id)?.name.split(" ")[0] ?? "Essa pessoa",
    };
    return { ok: false, error: issueMessage(decision.issues[0], names) };
  }

  const groupId = people.length > 1 ? `grp-${crypto.randomUUID().slice(0, 8)}` : null;
  const startsAt = fromLocal(input.day, input.start).toISOString();
  const rows = people.map((p, i) => {
    const price = priceFor(input.serviceIds, s.services, p.plan);
    return {
      customerId: p.id,
      barberId: decision.barberIds[i],
      unitId: decision.unitId,
      serviceIds: input.serviceIds,
      startsAt,
      durationMin,
      chargedCents: price.chargedCents,
      coveredCents: price.coveredCents,
      subscriptionId: price.coveredCents > 0 ? (p.subscription?.id ?? null) : null,
      groupId,
      channel: "app" as const,
    };
  });
  try {
    await getStore().createAppointments(rows);
  } catch {
    return { ok: false, error: "Não conseguimos salvar o agendamento agora. Tente de novo em instantes." };
  }
  revalidatePath("/", "layout");

  const fmt = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  return {
    ok: true,
    when: `${input.day}T${hhmm(input.start)}`,
    startsAt,
    durationMin,
    unitName: s.units.find((u) => u.id === decision.unitId)?.name ?? "",
    unitAddress: s.units.find((u) => u.id === decision.unitId)?.address ?? "",
    shopName: s.shop.name,
    people: rows.map((r, i) => ({
      name: people[i].name.split(" ")[0],
      barber: s.barbers.find((b) => b.id === r.barberId)?.name ?? "",
      services: services.map((x) => x!.name).join(" + "),
      payment: r.chargedCents === 0 ? "Incluso no Mister Club" : r.coveredCents > 0 ? `${fmt(r.chargedCents)} na barbearia (resto no clube)` : `${fmt(r.chargedCents)} na barbearia`,
    })),
  };
}
