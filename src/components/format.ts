import type { Appointment, Barber, Service, Unit } from "@/domain/types";
import { dayKey, hhmm, localParts, shortDate, weekdayLong } from "@/domain/time";

export function greeting(now: Date | string): string {
  const h = Math.floor(localParts(now).minutes / 60);
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

export function firstName(name: string): string {
  return name.split(" ")[0];
}

const h = (m: number) => (m % 60 ? hhmm(m).replace(":", "h") : `${m / 60}h`);

/** "Seg. a sex. 9h–20h · Sáb. 9h–19h · Dom. fechado" */
export function hoursLabel(unit: Unit): string[] {
  const [sun, mon, , , , fri, sat] = unit.hours;
  const out: string[] = [];
  if (mon && fri) out.push(`Seg. a sex. ${h(mon.open)}–${h(mon.close)}`);
  out.push(sat ? `Sáb. ${h(sat.open)}–${h(sat.close)}` : "Sáb. fechado");
  out.push(sun ? `Dom. ${h(sun.open)}–${h(sun.close)}` : "Dom. fechado");
  return out;
}

/** "hoje", "amanhã" or "quinta, 22 out" */
export function relativeDay(key: string, now: Date | string): string {
  const today = dayKey(now);
  if (key === today) return "hoje";
  const [y, m, d] = today.split("-").map(Number);
  const tomorrow = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
  if (key === tomorrow) return "amanhã";
  return `${weekdayLong(key)}, ${shortDate(key)}`;
}

export function appointmentWhen(a: Appointment, now: Date | string): string {
  return `${relativeDay(dayKey(a.startsAt), now)} às ${hhmm(localParts(a.startsAt).minutes)}`;
}

export function serviceNames(ids: string[], services: Service[]): string {
  const names = ids.map((id) => services.find((s) => s.id === id)?.name ?? "Serviço");
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} + ${names[names.length - 1]}` : names[0];
}

export function barberName(id: string, barbers: Barber[]): string {
  return barbers.find((b) => b.id === id)?.name ?? "Profissional";
}

export function mapsUrl(unit: Unit): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`Mister Bigode ${unit.address}`)}`;
}

export function whatsappUrl(phone: string): string {
  return `https://wa.me/55${phone.replace(/\D/g, "")}`;
}
