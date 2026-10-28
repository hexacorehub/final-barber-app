import type { Metadata } from "next";
import { addDays, dayKey, localParts, shortDate, weekdayOf, weekdayShort } from "@/domain/time";
import { RELATIONSHIP_LABEL } from "@/domain/household";
import { BOOKING_DAYS, bookablePeople, bookingUnits, busyMap, personBookings } from "@/server/booking";
import { loadSnapshot } from "@/server/data/store";
import { currentCustomerId } from "@/server/session";
import { customerHabit, nextUsualBooking } from "@/domain/assistants/habits";
import { BookingFlow, type BookingProps } from "./booking-flow";

export const metadata: Metadata = { title: "Agendar" };

/** Shown first; the rest sits behind "Ver todos os serviços". */
const MAIN_SERVICES = new Set(["svc-haircut", "svc-haircut-scissor", "svc-haircut-kids", "svc-beard", "svc-mustache", "svc-neckline"]);

export default async function BookingPage({ searchParams }: { searchParams: Promise<{ sempre?: string }> }) {
  const s = await loadSnapshot();
  const wantsUsual = (await searchParams).sempre === "1";
  const today = dayKey(s.now);
  const units = bookingUnits(s);
  const meId = await currentCustomerId();
  const people = bookablePeople(s, meId);
  const me = s.customers.find((c) => c.id === meId);
  const activeBarbers = s.barbers.filter((b) => b.active);
  const preferred = activeBarbers.find((b) => b.id === me?.preferredBarberId) ?? null;

  const days: BookingProps["days"] = Array.from({ length: BOOKING_DAYS }, (_, i) => {
    const key = addDays(today, i);
    const weekday = weekdayOf(key);
    return {
      key,
      weekday,
      label: i === 0 ? "Hoje" : i === 1 ? "Amanhã" : weekdayShort(key),
      sub: shortDate(key),
      closed: units.every((u) => !u.hours[weekday]),
    };
  });

  const habit = customerHabit(s, meId);
  const usual = wantsUsual ? nextUsualBooking(s, meId, BOOKING_DAYS) : null;
  const props: BookingProps = {
    people: people.map((p) => ({
      id: p.id,
      firstName: p.name.split(" ")[0],
      label: p.isSelf ? "Eu" : p.name.split(" ")[0],
      sub: p.isSelf ? p.name.split(" ")[0] : p.relationship ? RELATIONSHIP_LABEL[p.relationship] : "Na sua conta",
      plan: p.plan,
    })),
    services: s.services.filter((x) => x.bookable).map((x) => ({ ...x, main: MAIN_SERVICES.has(x.id) })),
    barbers: activeBarbers.map((b) => ({ id: b.id, name: b.name, unitId: b.unitId })),
    units: units.map((u) => ({ ...u, name: s.units.find((x) => x.id === u.id)!.name, address: s.units.find((x) => x.id === u.id)!.address })),
    busy: busyMap(s),
    existing: personBookings(
      s,
      people.map((p) => p.id),
    ),
    preferredBarberId: preferred?.id ?? null,
    days,
    today,
    nowMinutes: localParts(s.now).minutes,
    usual: habit ? { minute: habit.minute, weekday: habit.weekday, barberId: habit.barberId } : null,
    initial: usual
      ? {
          who: usual.customerIds.filter((id) => people.some((x) => x.id === id)),
          serviceIds: usual.habit.serviceIds,
          sel: { mode: "professional", unitId: null, barberId: usual.barberId },
          day: usual.day,
          start: usual.start,
        }
      : null,
  };

  return <BookingFlow {...props} />;
}
