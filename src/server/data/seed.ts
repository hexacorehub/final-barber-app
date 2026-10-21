import type { SupabaseClient } from "@supabase/supabase-js";
import { buildDemoSnapshot, DEMO_HOUSEHOLD_IDS } from "./demo-dataset";
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
} from "./rows";

/**
 * Fills Supabase with the Mister Bigode catalog and the demo account; with `history`, also
 * the simulated history dated from today (erasing the previous one). Shared by
 * `pnpm db:seed` and the app's automatic first-run load.
 */
export async function seedSupabase(db: SupabaseClient, opts: { history: boolean; log?: (line: string) => void }): Promise<void> {
  const log = opts.log ?? (() => {});
  const s = buildDemoSnapshot(new Date());

  const upsert = async (table: string, rows: Record<string, unknown>[]) => {
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await db.from(table).upsert(rows.slice(i, i + 500));
      if (error) throw new Error(`Supabase: ${table}: ${error.message}`);
    }
    log(`  ${table}: ${rows.length}`);
  };

  log("Catálogo:");
  await upsert("shop_settings", [shopToRow(s.shop)]);
  await upsert("units", s.units.map(unitToRow));
  await upsert("barbers", s.barbers.map(barberToRow));
  await upsert("services", s.services.map(serviceToRow));
  await upsert("plans", s.plans.map(planToRow));
  await upsert("products", s.products.map(productToRow));

  if (!opts.history) {
    // The customer app has no login yet: it opens as this demo customer (with his son and
    // father-in-law in the same account). Holder first: the others reference him.
    const ids = new Set(DEMO_HOUSEHOLD_IDS);
    log("Conta de demonstração do app:");
    await upsert("customers", s.customers.filter((c) => ids.has(c.id) && !c.holderId).map(customerToRow));
    await upsert("customers", s.customers.filter((c) => ids.has(c.id) && c.holderId).map(customerToRow));
    await upsert("subscriptions", s.subscriptions.filter((x) => ids.has(x.customerId)).map((x) => subscriptionToRow({ ...x, referredByCustomerId: null })));
    return;
  }

  log("Apagando o histórico anterior…");
  for (const table of ["gallery_photos", "plan_leads", "product_reservations", "product_sales", "appointments", "subscriptions"]) {
    const { error } = await db.from(table).delete().neq("id", "");
    if (error) throw new Error(`Supabase: ${table}: ${error.message}`);
  }
  for (const managedOnly of [true, false]) {
    const q = db.from("customers").delete();
    const { error } = await (managedOnly ? q.not("holder_id", "is", null) : q.neq("id", ""));
    if (error) throw new Error(`Supabase: customers: ${error.message}`);
  }

  log("Histórico de demonstração:");
  await upsert("customers", s.customers.filter((c) => !c.holderId).map(customerToRow));
  await upsert("customers", s.customers.filter((c) => c.holderId).map(customerToRow));
  await upsert("subscriptions", s.subscriptions.map(subscriptionToRow));
  await upsert("appointments", s.appointments.map(appointmentToRow));
  await upsert("product_sales", s.productSales.map(saleToRow));
  await upsert("product_reservations", s.reservations.map(reservationToRow));
  await upsert("plan_leads", s.leads.map(leadToRow));
  await upsert("gallery_photos", s.galleryPhotos.map(photoToRow));
}
