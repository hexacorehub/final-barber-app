/**
 * Loads the Mister Bigode catalog into Supabase (units, barbers, services, plans, products,
 * shop settings). With --demo it also loads the generated demo history (customers,
 * subscriptions, appointments, sales), relative to today.
 *
 *   pnpm db:seed           # catalog only — safe to rerun, it upserts
 *   pnpm db:seed --demo    # catalog + demo history (ERASES customers, plans sold,
 *                          # appointments, sales, requests and photos first — demo only)
 *
 * Needs SUPABASE_URL and SUPABASE_SECRET_KEY in .env, and supabase/schema.sql applied.
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { buildDemoSnapshot, DEMO_HOUSEHOLD_IDS } from "../src/server/data/demo-dataset";
import {
  appointmentToRow,
  barberToRow,
  customerToRow,
  leadToRow,
  photoToRow,
  planToRow,
  productToRow,
  reservationToRow,
  saleToRow,
  serviceToRow,
  shopToRow,
  subscriptionToRow,
  unitToRow,
} from "../src/server/data/rows";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error("Defina SUPABASE_URL e SUPABASE_SECRET_KEY no .env antes de rodar o seed.");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });
const withDemo = process.argv.includes("--demo");

async function upsert(table: string, rows: Record<string, unknown>[]) {
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await db.from(table).upsert(rows.slice(i, i + 500));
    if (error) throw new Error(`${table}: ${error.message}`);
  }
  console.log(`  ${table}: ${rows.length}`);
}

async function main() {
  const s = buildDemoSnapshot(new Date());
  console.log("Catálogo:");
  await upsert("shop_settings", [shopToRow(s.shop)]);
  await upsert("units", s.units.map(unitToRow));
  await upsert("barbers", s.barbers.map(barberToRow));
  await upsert("services", s.services.map(serviceToRow));
  await upsert("plans", s.plans.map(planToRow));
  await upsert("products", s.products.map(productToRow));
  if (!withDemo) {
    // The customer app has no login yet: it opens as this demo customer (with his son and
    // father-in-law in the same account).
    const demoIds = new Set(DEMO_HOUSEHOLD_IDS);
    console.log("Conta de demonstração do app:");
    // Holder first: the others reference him.
    await upsert("customers", s.customers.filter((c) => demoIds.has(c.id) && !c.holderId).map(customerToRow));
    await upsert("customers", s.customers.filter((c) => demoIds.has(c.id) && c.holderId).map(customerToRow));
    await upsert("subscriptions", s.subscriptions.filter((x) => demoIds.has(x.customerId)).map((x) => subscriptionToRow({ ...x, referredByCustomerId: null })));
    console.log("Pronto. Para carregar também o histórico de demonstração: pnpm db:seed --demo");
    return;
  }
  console.log("Apagando o histórico anterior (modo demonstração)…");
  for (const table of ["gallery_photos", "plan_leads", "product_reservations", "product_sales", "appointments", "subscriptions"]) {
    const { error } = await db.from(table).delete().neq("id", "");
    if (error) throw new Error(`${table}: ${error.message}`);
  }
  // Managed members first: they reference their holder.
  for (const filter of [true, false]) {
    const q = db.from("customers").delete();
    const { error } = await (filter ? q.not("holder_id", "is", null) : q.neq("id", ""));
    if (error) throw new Error(`customers: ${error.message}`);
  }
  console.log("Histórico de demonstração:");
  await upsert("customers", s.customers.filter((c) => !c.holderId).map(customerToRow));
  await upsert("customers", s.customers.filter((c) => c.holderId).map(customerToRow));
  await upsert("subscriptions", s.subscriptions.map(subscriptionToRow));
  await upsert("appointments", s.appointments.map(appointmentToRow));
  await upsert("product_sales", s.productSales.map(saleToRow));
  await upsert("product_reservations", s.reservations.map(reservationToRow));
  await upsert("plan_leads", s.leads.map(leadToRow));
  await upsert("gallery_photos", s.galleryPhotos.map(photoToRow));
  console.log("Pronto.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
