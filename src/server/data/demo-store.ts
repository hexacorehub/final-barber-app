import type { Appointment, Customer, PlanLead, ProductReservation, Snapshot } from "@/domain/types";
import { dayKey } from "@/domain/time";
import { referralCodeFor } from "@/domain/household";
import { buildDemoSnapshot } from "./demo-dataset";
import type { NewAppointment, NewCustomer, NewPlanLead, NewReservation, Store } from "./store";

/**
 * In-memory store for the demo. The generated history is rebuilt each hour so it stays
 * relative to today; what people create in the app is kept on top of it while the server
 * process lives (on Vercel that is per instance — fine for showing the experience).
 */
export function createDemoStore(): Store {
  let cacheKey = "";
  let base: Snapshot | null = null;
  const created = { appointments: [] as Appointment[], reservations: [] as ProductReservation[], leads: [] as PlanLead[], customers: [] as Customer[] };

  const id = (prefix: string) => `${prefix}-${crypto.randomUUID().slice(0, 8)}`;

  return {
    mode: "demo",
    async snapshot(now) {
      const key = `${dayKey(now)}-${now.getUTCHours()}`;
      if (key !== cacheKey || !base) {
        base = buildDemoSnapshot(now);
        cacheKey = key;
      }
      return {
        ...base,
        now: now.toISOString(),
        appointments: created.appointments.length ? [...base.appointments, ...created.appointments].sort((a, b) => a.startsAt.localeCompare(b.startsAt)) : base.appointments,
        reservations: [...base.reservations, ...created.reservations],
        leads: [...base.leads, ...created.leads],
        customers: created.customers.length ? [...base.customers, ...created.customers] : base.customers,
      };
    },
    async createAppointments(items: NewAppointment[]) {
      const rows = items.map((item) => ({ ...item, id: id("appt"), status: "scheduled" as const }));
      created.appointments.push(...rows);
      return rows;
    },
    async createReservation(item: NewReservation) {
      const row: ProductReservation = { ...item, id: id("res"), status: "reserved", createdAt: new Date().toISOString() };
      created.reservations.push(row);
      return row;
    },
    async createCustomer(item: NewCustomer) {
      const row: Customer = {
        ...item,
        id: id("cust"),
        createdAt: new Date().toISOString(),
        cycleDays: 21,
        preferredBarberId: null,
        referralCode: referralCodeFor(item.name, Math.floor(Math.random() * 10000)),
      };
      created.customers.push(row);
      return row;
    },
    async createPlanLead(item: NewPlanLead) {
      const row: PlanLead = { ...item, id: id("lead"), createdAt: new Date().toISOString() };
      created.leads.push(row);
      return row;
    },
  };
}
