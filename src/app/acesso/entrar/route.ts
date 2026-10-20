import { NextResponse, type NextRequest } from "next/server";
import { grantDemoAccess } from "@/server/demo-access";

/** Shareable link: /acesso/entrar?codigo=<code> opens the demo without typing the code. */
export async function GET(req: NextRequest) {
  const ok = await grantDemoAccess(req.nextUrl.searchParams.get("codigo") ?? "");
  return NextResponse.redirect(new URL(ok ? "/acesso" : "/acesso?erro=1", req.url));
}
