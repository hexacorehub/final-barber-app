/**
 * Writes the seed as plain SQL, to paste in Supabase → SQL Editor (no local setup needed).
 *
 *   pnpm db:seed-sql   →  supabase/seed.sql          (catalog + demo account)
 *                         supabase/seed-demo-N.sql  (demo history in parts, dated from today)
 */
import { readdirSync, unlinkSync, writeFileSync } from "node:fs";
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

type Row = Record<string, unknown>;
const ARRAY_COLUMNS = new Set(["covers", "benefits", "service_ids"]);

function lit(col: string, v: unknown): string {
  if (v === null || v === undefined) return "null";
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") return String(v);
  if (Array.isArray(v) && ARRAY_COLUMNS.has(col)) return `array[${v.map((x) => lit("", x)).join(",")}]::text[]`;
  if (typeof v === "object") return `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`;
  return `'${String(v).replace(/'/g, "''")}'`;
}

function insert(table: string, rows: Row[], chunk = 300): string {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const out: string[] = [];
  for (let i = 0; i < rows.length; i += chunk) {
    const values = rows.slice(i, i + chunk).map((r) => `(${cols.map((c) => lit(c, r[c])).join(",")})`);
    const updates = cols.filter((c) => c !== "id").map((c) => `${c} = excluded.${c}`).join(", ");
    out.push(`insert into ${table} (${cols.join(",")}) values\n${values.join(",\n")}\non conflict (id) do update set ${updates};`);
  }
  return out.join("\n\n") + "\n\n";
}

const s = buildDemoSnapshot(new Date());
const household = new Set(DEMO_HOUSEHOLD_IDS);
const today = s.now.slice(0, 10);

let catalog = `-- Final Barber · catálogo + conta de demonstração (gerado em ${today}).\n-- Rode depois do schema.sql. Pode rodar de novo: atualiza o que já existe.\nbegin;\n\n`;
catalog += insert("shop_settings", [shopToRow(s.shop)]);
catalog += insert("units", s.units.map(unitToRow));
catalog += insert("barbers", s.barbers.map(barberToRow));
catalog += insert("services", s.services.map(serviceToRow));
catalog += insert("plans", s.plans.map(planToRow));
catalog += insert("products", s.products.map(productToRow));
catalog += insert("customers", s.customers.filter((c) => household.has(c.id) && !c.holderId).map(customerToRow));
catalog += insert("customers", s.customers.filter((c) => household.has(c.id) && c.holderId).map(customerToRow));
catalog += insert("subscriptions", s.subscriptions.filter((x) => household.has(x.customerId)).map((x) => subscriptionToRow({ ...x, referredByCustomerId: null })));
catalog += "commit;\n";
writeFileSync("supabase/seed.sql", catalog);

// Demo history, split in parts small enough for the SQL Editor; run them in order.
const header = (n: number, total: number, extra: string) =>
  `-- Final Barber · histórico de demonstração, parte ${n} de ${total} (datas a partir de ${today}).\n-- Rode as partes em ordem, depois do seed.sql. Só para ambiente de demonstração.\n${extra}`;
const parts: string[] = [];
let p1 = "-- Esta parte APAGA e recria clientes, assinaturas e o histórico.\nbegin;\n\n";
p1 += "delete from gallery_photos; delete from plan_leads; delete from product_reservations; delete from product_sales; delete from appointments; delete from subscriptions;\n";
p1 += "delete from customers where holder_id is not null; delete from customers;\n\n";
p1 += insert("customers", s.customers.filter((c) => !c.holderId).map(customerToRow));
p1 += insert("customers", s.customers.filter((c) => c.holderId).map(customerToRow));
p1 += insert("subscriptions", s.subscriptions.map(subscriptionToRow));
p1 += insert("product_sales", s.productSales.map(saleToRow));
p1 += insert("product_reservations", s.reservations.map(reservationToRow));
p1 += insert("plan_leads", s.leads.map(leadToRow));
p1 += "commit;\n";
parts.push(p1);
const appts = s.appointments.map(appointmentToRow);
const PER_PART = 2600;
for (let i = 0; i < appts.length; i += PER_PART) {
  const last = i + PER_PART >= appts.length;
  parts.push(`begin;\n\n${insert("appointments", appts.slice(i, i + PER_PART))}${last ? insert("gallery_photos", s.galleryPhotos.map(photoToRow)) : ""}commit;\n`);
}
for (const f of readdirSync("supabase").filter((f) => /^seed-demo.*\.sql$/.test(f))) unlinkSync(`supabase/${f}`);
parts.forEach((body, i) => {
  const extra = i === 0 ? "" : "-- Atendimentos" + (i === parts.length - 1 ? " e fotos da galeria.\n" : ".\n");
  writeFileSync(`supabase/seed-demo-${i + 1}.sql`, header(i + 1, parts.length, extra) + body);
});

console.log(`supabase/seed.sql: ${(catalog.length / 1024).toFixed(0)} KB`);
parts.forEach((b, i) => console.log(`supabase/seed-demo-${i + 1}.sql: ${(b.length / 1024).toFixed(0)} KB`));
