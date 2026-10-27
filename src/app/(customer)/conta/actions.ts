"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { RELATIONSHIPS, checkAddMember } from "@/domain/household";
import { checkMemberCpf } from "@/domain/signup";
import type { Relationship } from "@/domain/types";
import { getStore, loadFreshSnapshot } from "@/server/data/store";
import { canSeeApp } from "@/server/demo-access";
import { currentCustomerId } from "@/server/session";

const Input = z.object({
  name: z.string().trim().min(2).max(80),
  relationship: z.enum(RELATIONSHIPS as [Relationship, ...Relationship[]]),
  minor: z.boolean(),
  phone: z.string().trim().max(20).optional(),
  cpf: z.string().trim().max(20).optional(),
});

export type AddMemberState = { error: string | null; added: string | null };

/** The holder adds someone they manage (son, father-in-law…). Only the holder can. */
export async function addMember(_: AddMemberState, form: FormData): Promise<AddMemberState> {
  if (!(await canSeeApp())) return { error: "Acesso de demonstração expirado. Entre de novo.", added: null };
  const parsed = Input.safeParse({
    name: form.get("name"),
    relationship: form.get("relationship"),
    minor: form.get("minor") === "on",
    phone: form.get("phone") || undefined,
    cpf: form.get("cpf") || undefined,
  });
  if (!parsed.success) return { error: "Preencha o nome e o parentesco.", added: null };
  const s = await loadFreshSnapshot();
  const me = await currentCustomerId();
  const check = checkAddMember(s, me, parsed.data.name);
  if (!check.ok) return { error: check.error, added: null };
  const cpf = checkMemberCpf(parsed.data.cpf, s.customers);
  if (!cpf.ok) return { error: cpf.error, added: null };
  const holder = s.customers.find((c) => c.id === me)!;
  await getStore().createCustomer({
    name: parsed.data.name.replace(/\s+/g, " "),
    phone: parsed.data.phone || holder.phone,
    holderId: me,
    relationship: parsed.data.relationship,
    minor: parsed.data.minor,
    cpf: cpf.cpf,
  });
  revalidatePath("/", "layout");
  return { error: null, added: parsed.data.name.split(" ")[0] };
}
