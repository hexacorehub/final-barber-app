import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Snapshot } from "@/domain/types";
import {
  appointmentFromRow,
  appointmentToRow,
  barberFromRow,
  customerFromRow,
  customerToRow,
  leadFromRow,
  leadToRow,
  photoFromRow,
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
import { referralCodeFor } from "@/domain/household";
import { seedSupabase } from "./seed";
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

/**
 * Reads a whole table (or a time window of it). The first page also returns the row count,
 * so the remaining pages are fetched in parallel instead of one after another: two round
 * trips for any table size instead of one per 1,000 rows.
 */
async function fetchAll(db: SupabaseClient, table: string, since?: { column: string; iso: string }): Promise<Row[]> {
  const page = (from: number, withCount: boolean) => {
    let q = db
      .from(table)
      .select("*", withCount ? { count: "exact" } : undefined)
      .order("id")
      .range(from, from + PAGE - 1);
    if (since) q = q.gte(since.column, since.iso);
    return q;
  };
  const first = await page(0, true);
  if (first.error) throw new Error(`Supabase: falha ao ler ${table}: ${first.error.message}`);
  const rows = (first.data ?? []) as Row[];
  const total = first.count ?? rows.length;
  if (rows.length >= total || rows.length < PAGE) return rows;
  const rest = await Promise.all(Array.from({ length: Math.ceil(total / PAGE) - 1 }, (_, i) => page((i + 1) * PAGE, false)));
  for (const r of rest) {
    if (r.error) throw new Error(`Supabase: falha ao ler ${table}: ${r.error.message}`);
    rows.push(...((r.data ?? []) as Row[]));
  }
  return rows;
}

/**
 * How long a loaded snapshot is reused by this server instance. Writes made through this
 * instance drop it at once; the booking check always reads fresh data, so a stale copy can
 * never confirm a taken slot.
 */
const SNAPSHOT_TTL_MS = Number(process.env.SNAPSHOT_TTL_MS ?? 30_000);

/** Whether the automatic first-run load includes the simulated history (default: yes). */
export function seedsDemoHistory(): boolean {
  return process.env.SEED_DEMO_HISTORY !== "false";
}

let firstRun: Promise<void> | null = null;

/** Fills an empty project on first use, so no manual seeding is needed. */
async function ensureSeeded(db: SupabaseClient): Promise<void> {
  const { data, error } = await db.from("shop_settings").select("id").eq("id", 1).maybeSingle();
  if (error) {
    throw new Error(
      `Supabase: não consegui ler as tabelas (${error.message}). Confira se o supabase/schema.sql foi rodado no SQL Editor e se a chave é a secreta (sb_secret_…).`,
    );
  }
  if (data) return;
  await seedSupabase(db, { history: seedsDemoHistory(), log: (l) => console.log(`[seed] ${l}`) });
}

type Data = Omit<Snapshot, "now">;

export function createSupabaseStore(): Store {
  const db = createSupabaseAdmin();
  let cached: { at: number; data: Data } | null = null;
  let inflight: Promise<Data> | null = null;
  const invalidate = () => {
    cached = null;
  };

  /** One load at a time: concurrent requests share it instead of each hitting Supabase. */
  const load = (): Promise<Data> => {
    inflight ??= loadData(new Date())
      .then((data) => {
        cached = { at: Date.now(), data };
        return data;
      })
      .finally(() => {
        inflight = null;
      });
    return inflight;
  };

  async function loadData(now: Date): Promise<Data> {
    firstRun ??= ensureSeeded(db).catch((e) => {
      firstRun = null;
      throw e;
    });
    await firstRun;
    const since = new Date(now.getTime() - HISTORY_DAYS * 86_400_000).toISOString();
    const [shop, units, barbers, services, plans, products, customers, subscriptions, appointments, sales, reservations, leads, photos] = await Promise.all([
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
      fetchAll(db, "gallery_photos"),
    ]);
    if (shop.error) throw new Error(`Supabase: falha ao ler shop_settings: ${shop.error.message}`);
    if (!shop.data) throw new Error("Supabase: tabela shop_settings vazia.");

    return {
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
      galleryPhotos: photos.map(photoFromRow),
    };
  }

  return {
    mode: "supabase",
    async snapshot(now, opts) {
      const fresh = opts?.fresh || !cached || Date.now() - cached.at > SNAPSHOT_TTL_MS;
      const data = fresh ? await load() : cached!.data;
      return { ...data, now: now.toISOString() };
    },
    async reseedDemo() {
      await seedSupabase(db, { history: true });
      invalidate();
    },
    async createAppointments(items) {
      const rows = items.map((item) => ({ ...item, id: `appt-${crypto.randomUUID()}`, status: "scheduled" as const }));
      const { error } = await db.from("appointments").insert(rows.map(appointmentToRow));
      if (error) throw new Error(`Supabase: falha ao criar agendamento: ${error.message}`);
      invalidate();
      return rows;
    },
    async createReservation(item) {
      const row = { ...item, id: `res-${crypto.randomUUID()}`, status: "reserved" as const, createdAt: new Date().toISOString() };
      const { error } = await db.from("product_reservations").insert(reservationToRow(row));
      if (error) throw new Error(`Supabase: falha ao reservar produto: ${error.message}`);
      invalidate();
      return row;
    },
    async createCustomer(item) {
      const row = {
        ...item,
        id: `cust-${crypto.randomUUID()}`,
        createdAt: new Date().toISOString(),
        cycleDays: 21,
        preferredBarberId: null,
        referralCode: referralCodeFor(item.name, Math.floor(Math.random() * 10000)),
      };
      const { error } = await db.from("customers").insert(customerToRow(row));
      if (error) throw new Error(`Supabase: falha ao adicionar pessoa: ${error.message}`);
      invalidate();
      return row;
    },
    async createPlanLead(item) {
      const row = { ...item, id: `lead-${crypto.randomUUID()}`, createdAt: new Date().toISOString() };
      const { error } = await db.from("plan_leads").insert(leadToRow(row));
      if (error) throw new Error(`Supabase: falha ao registrar interesse: ${error.message}`);
      invalidate();
      return row;
    },
  };
}
