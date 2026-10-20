import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Snapshot } from "@/domain/types";
import {
  appointmentFromRow,
  appointmentToRow,
  barberFromRow,
  customerFromRow,
  leadFromRow,
  leadToRow,
  planFromRow,
  productFromRow,
  reservationFromRow,
  reservationToRow,
  saleFromRow,
  serviceFromRow,
  shopFromRow,
  subscriptionFromRow,
  unitFromRow,
} from "./rows";
import type { Store } from "./store";

/** History window loaded for the dashboards (covers "mês anterior" and the six-month charts). */
const HISTORY_DAYS = 200;
const PAGE = 1000;

export function supabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);
}

export function createSupabaseAdmin(): SupabaseClient {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

type Row = Record<string, unknown>;

async function fetchAll(db: SupabaseClient, table: string, since?: { column: string; iso: string }): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = db.from(table).select("*").order("id").range(from, from + PAGE - 1);
    if (since) q = q.gte(since.column, since.iso);
    const { data, error } = await q;
    if (error) throw new Error(`Supabase: falha ao ler ${table}: ${error.message}`);
    rows.push(...((data ?? []) as Row[]));
    if (!data || data.length < PAGE) return rows;
  }
}

export function createSupabaseStore(): Store {
  const db = createSupabaseAdmin();

  return {
    mode: "supabase",
    async snapshot(now) {
      const since = new Date(now.getTime() - HISTORY_DAYS * 86_400_000).toISOString();
      const [shop, units, barbers, services, plans, products, customers, subscriptions, appointments, sales, reservations, leads] = await Promise.all([
        db.from("shop_settings").select("*").eq("id", 1).maybeSingle(),
        fetchAll(db, "units"),
        fetchAll(db, "barbers"),
        fetchAll(db, "services"),
        fetchAll(db, "plans"),
        fetchAll(db, "products"),
        fetchAll(db, "customers"),
        fetchAll(db, "subscriptions"),
        fetchAll(db, "appointments", { column: "starts_at", iso: since }),
        fetchAll(db, "product_sales", { column: "sold_at", iso: since }),
        fetchAll(db, "product_reservations"),
        fetchAll(db, "plan_leads"),
      ]);
      if (shop.error) throw new Error(`Supabase: falha ao ler shop_settings: ${shop.error.message}`);
      if (!shop.data) throw new Error("Supabase: tabela shop_settings vazia. Rode `pnpm db:seed`.");

      const snapshot: Snapshot = {
        shop: shopFromRow(shop.data as Row),
        units: units.map(unitFromRow),
        barbers: barbers.map(barberFromRow),
        services: services.map(serviceFromRow),
        plans: plans.map(planFromRow).sort((a, b) => a.sortOrder - b.sortOrder),
        products: products.map(productFromRow),
        customers: customers.map(customerFromRow),
        subscriptions: subscriptions.map(subscriptionFromRow),
        appointments: appointments.map(appointmentFromRow).sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
        productSales: sales.map(saleFromRow).sort((a, b) => a.soldAt.localeCompare(b.soldAt)),
        reservations: reservations.map(reservationFromRow),
        leads: leads.map(leadFromRow),
        now: now.toISOString(),
      };
      return snapshot;
    },
    async createAppointments(items) {
      const rows = items.map((item) => ({ ...item, id: `appt-${crypto.randomUUID()}`, status: "scheduled" as const }));
      const { error } = await db.from("appointments").insert(rows.map(appointmentToRow));
      if (error) throw new Error(`Supabase: falha ao criar agendamento: ${error.message}`);
      return rows;
    },
    async createReservation(item) {
      const row = { ...item, id: `res-${crypto.randomUUID()}`, status: "reserved" as const, createdAt: new Date().toISOString() };
      const { error } = await db.from("product_reservations").insert(reservationToRow(row));
      if (error) throw new Error(`Supabase: falha ao reservar produto: ${error.message}`);
      return row;
    },
    async createPlanLead(item) {
      const row = { ...item, id: `lead-${crypto.randomUUID()}`, createdAt: new Date().toISOString() };
      const { error } = await db.from("plan_leads").insert(leadToRow(row));
      if (error) throw new Error(`Supabase: falha ao registrar interesse: ${error.message}`);
      return row;
    },
  };
}
