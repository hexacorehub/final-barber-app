import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { financeExport } from "@/domain/finance-export";
import { addDays, dayKey, daysBetween } from "@/domain/time";
import { loadSnapshot } from "@/server/data/store";

export const dynamic = "force-dynamic";

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 92;

/**
 * Read-only export for Final Finance (docs/finance-contract.md). Closed unless
 * FINANCE_EXPORT_TOKEN is set; the caller sends it as "Authorization: Bearer <token>".
 */
export async function GET(req: Request) {
  const token = process.env.FINANCE_EXPORT_TOKEN;
  if (!token) return NextResponse.json({ error: "Exportação desligada: defina FINANCE_EXPORT_TOKEN." }, { status: 503 });
  const sent = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const a = Buffer.from(sent);
  const b = Buffer.from(token);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  const url = new URL(req.url);
  const s = await loadSnapshot();
  const today = dayKey(s.now);
  const to = url.searchParams.get("to") ?? today;
  const from = url.searchParams.get("from") ?? addDays(to, -6);
  if (!DAY.test(from) || !DAY.test(to) || from > to) return NextResponse.json({ error: "Use from e to no formato AAAA-MM-DD, com from ≤ to." }, { status: 400 });
  if (daysBetween(from, to) >= MAX_DAYS) return NextResponse.json({ error: `No máximo ${MAX_DAYS} dias por pedido.` }, { status: 400 });

  return NextResponse.json(financeExport(s, { from, to, cnpj: url.searchParams.get("cnpj") }), { headers: { "cache-control": "no-store" } });
}
