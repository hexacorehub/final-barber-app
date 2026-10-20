import type { Metadata } from "next";
import { addDays, dayKey, localParts, shortDate, weekdayOf, weekdayShort } from "@/domain/time";
import { RELATIONSHIP_LABEL } from "@/domain/household";
import { BOOKING_DAYS, bookablePeople, bookingUnits, busyMap } from "@/server/booking";
import { loadSnapshot } from "@/server/data/store";
import { currentCustomerId } from "@/server/session";
import { BookingFlow, type BookingProps } from "./booking-flow";

export const metadata: Metadata = { title: "Agendar" };

/** Shown first; the rest sits behind "Ver todos os serviços". */
const MAIN_SERVICES = new Set(["svc-haircut", "svc-haircut-scissor", "svc-haircut-kids", "svc-beard", "svc-mustache", "svc-neckline"]);

export default async function BookingPage() {
  const s = await loadSnapshot();
  const today = dayKey(s.now);
  const units = bookingUnits(s);

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

  const props: BookingProps = {
    people: bookablePeople(s, await currentCustomerId()).map((p) => ({
      id: p.id,
      firstName: p.name.split(" ")[0],
      label: p.isSelf ? "Eu" : p.name.split(" ")[0],
      sub: p.isSelf ? p.name.split(" ")[0] : p.relationship ? RELATIONSHIP_LABEL[p.relationship] : "Na sua conta",
      plan: p.plan,
    })),
    services: s.services
      .filter((x) => x.bookable)
      .map((x) => ({ ...x, main: MAIN_SERVICES.has(x.id) })),
    barbers: s.barbers.filter((b) => b.active).map((b) => ({ id: b.id, name: b.name, unitId: b.unitId })),
    units: units.map((u) => ({ ...u, name: s.units.find((x) => x.id === u.id)!.name })),
    busy: busyMap(s),
    days,
    today,
    nowMinutes: localParts(s.now).minutes,
  };

  return <BookingFlow {...props} />;
}
