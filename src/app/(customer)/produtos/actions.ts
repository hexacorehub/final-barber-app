"use server";

import { revalidatePath } from "next/cache";
import { getStore, loadFreshSnapshot } from "@/server/data/store";
import { canSeeApp } from "@/server/demo-access";
import { currentCustomerId } from "@/server/session";

/** Reserve a product to pick up and pay at the next visit (no online payment in the MVP). */
export async function reserveProduct(productId: string): Promise<{ ok: boolean; error?: string }> {
  if (!(await canSeeApp())) return { ok: false, error: "Acesso de demonstração expirado. Entre de novo." };
  const s = await loadFreshSnapshot();
  const product = s.products.find((p) => p.id === productId && p.active);
  if (!product) return { ok: false, error: "Produto indisponível." };
  if (product.stock <= 0) return { ok: false, error: "Esgotado no momento." };
  await getStore().createReservation({ productId, customerId: await currentCustomerId(), quantity: 1 });
  revalidatePath("/painel", "layout");
  return { ok: true };
}
