"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { planBooking } from "@/domain/availability";
import { addDays, dayKey, fromLocal, hhmm, localParts, weekdayOf } from "@/domain/time";
import { BOOKING_DAYS, bookablePeople, bookingUnits, busyMap, priceFor } from "@/server/booking";
import { getStore, loadSnapshot } from "@/server/data/store";
import { currentCustomerId } from "@/server/session";

const Input = z.object({
  customerIds: z.array(z.string()).min(1).max(4),
  serviceIds: z.array(z.string()).min(1).max(4),
  unitId: z.string().nullable(),
  barberId: z.string().nullable(),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start: z.number().int().min(0).max(24 * 60),
});

export type BookingResult =
  | { ok: true; when: string; unitName: string; people: { name: string; barber: string; services: string; payment: string }[] }
  | { ok: false; error: string };

export async function bookAppointments(raw: z.infer<typeof Input>): Promise<BookingResult> {
  const parsed = Input.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Escolha quem vai, o serviço e um horário." };
  const input = parsed.data;

  const s = await loadSnapshot();
  const me = await currentCustomerId();
  const people = bookablePeople(s, me).filter((p) => input.customerIds.includes(p.id));
  if (people.length !== input.customerIds.length) return { ok: false, error: "Só é possível agendar para você e seus dependentes." };

  const services = input.serviceIds.map((id) => s.services.find((x) => x.id === id && x.bookable));
  if (services.some((x) => !x)) return { ok: false, error: "Serviço indisponível." };

  const today = dayKey(s.now);
  if (input.day < today || input.day > addDays(today, BOOKING_DAYS)) return { ok: false, error: "Escolha um dia dentro da próxima semana." };

  const durationMin = services.reduce((t, x) => t + x!.durationMin, 0);
  const plan = planBooking({
    units: bookingUnits(s),
    unitId: input.unitId,
    barberId: input.barberId,
    day: input.day,
    weekday: weekdayOf(input.day),
    start: input.start,
    durationMin,
    people: people.length,
    busy: busyMap(s),
    nowMinutes: input.day === today ? localParts(s.now).minutes : null,
  });
  if (!plan) return { ok: false, error: "Esse horário acabou de ser ocupado. Escolha outro." };

  const groupId = people.length > 1 ? `grp-${crypto.randomUUID().slice(0, 8)}` : null;
  const startsAt = fromLocal(input.day, input.start).toISOString();
  const rows = people.map((p, i) => {
    const price = priceFor(input.serviceIds, s.services, p.plan);
    return {
      customerId: p.id,
      barberId: plan.barberIds[i],
      unitId: plan.unitId,
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
  await getStore().createAppointments(rows);
  revalidatePath("/", "layout");

  const fmt = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  return {
    ok: true,
    when: `${input.day}T${hhmm(input.start)}`,
    unitName: s.units.find((u) => u.id === plan.unitId)?.name ?? "",
    people: rows.map((r, i) => ({
      name: people[i].name.split(" ")[0],
      barber: s.barbers.find((b) => b.id === r.barberId)?.name ?? "",
      services: services.map((x) => x!.name).join(" + "),
      payment: r.chargedCents === 0 ? "Incluso no Mister Club" : r.coveredCents > 0 ? `${fmt(r.chargedCents)} na barbearia (resto no clube)` : `${fmt(r.chargedCents)} na barbearia`,
    })),
  };
}
