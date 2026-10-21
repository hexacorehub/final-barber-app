/**
 * Loads the Mister Bigode catalog into Supabase (units, barbers, services, plans, products,
 * shop settings) and the demo account. With --demo it also loads the generated demo history
 * (customers, subscriptions, appointments, sales), relative to today.
 *
 *   pnpm db:seed           # catalog only — safe to rerun, it upserts
 *   pnpm db:seed --demo    # catalog + demo history (ERASES customers, plans sold,
 *                          # appointments, sales, requests and photos first — demo only)
 *
 * Usually not needed: the app fills an empty database by itself on first run.
 * Needs SUPABASE_URL and SUPABASE_SECRET_KEY in .env, and supabase/schema.sql applied.
 */
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { seedSupabase } from "../src/server/data/seed";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) {
  console.error("Defina SUPABASE_URL e SUPABASE_SECRET_KEY no .env antes de rodar o seed.");
  process.exit(1);
}

seedSupabase(createClient(url, key, { auth: { persistSession: false } }), { history: process.argv.includes("--demo"), log: console.log })
  .then(() => console.log("Pronto."))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
