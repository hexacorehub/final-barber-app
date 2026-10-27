"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { checkAccessChange, PERMISSIONS, ROLE_LABEL, type Grant, type Permission, type Role } from "@/domain/access";
import { audit, createStaff, currentStaff, listStaff, saveStaff, staffLoginEnabled } from "@/server/staff";

const GRANTS = ["all", "units", "own", "none", "default"] as const;
const label: Record<string, string> = { all: "todas as unidades", units: "as unidades dela", own: "só o dele", none: "sem acesso" };

export async function setPermission(staffId: string, permission: string, value: string): Promise<{ error: string | null }> {
  const actor = await currentStaff();
  const target = (await listStaff()).find((x) => x.id === staffId);
  const perm = PERMISSIONS.find((p) => p.key === permission)?.key as Permission | undefined;
  if (!target || !perm || !(GRANTS as readonly string[]).includes(value)) return { error: "Pedido inválido." };
  const grant: Grant | undefined = value === "default" ? undefined : value === "none" ? false : (value as Grant);
  const overrides = { ...target.overrides };
  if (grant === undefined) delete overrides[perm];
  else overrides[perm] = grant;
  const check = checkAccessChange(actor, target, overrides);
  if (!check.ok) return { error: check.error };
  await saveStaff({ ...target, overrides });
  await audit(actor!, target, `${PERMISSIONS.find((p) => p.key === perm)!.label}: ${value === "default" ? "padrão da função" : label[value]}`);
  revalidatePath("/painel", "layout");
  return { error: null };
}

export async function setActive(staffId: string, active: boolean): Promise<{ error: string | null }> {
  const actor = await currentStaff();
  const target = (await listStaff()).find((x) => x.id === staffId);
  if (!target) return { error: "Pessoa não encontrada." };
  const check = checkAccessChange(actor, target, {});
  if (!check.ok) return { error: check.error };
  await saveStaff({ ...target, active });
  await audit(actor!, target, active ? "Acesso reativado" : "Acesso desligado");
  revalidatePath("/painel", "layout");
  return { error: null };
}

const NewMember = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().email().max(120),
  role: z.enum(["manager", "reception", "barber"]),
  unitId: z.string().min(1).max(64),
  barberId: z.string().max(64).optional(),
});

export async function addMember(_: { error: string | null; created: string | null }, form: FormData): Promise<{ error: string | null; created: string | null }> {
  const actor = await currentStaff();
  if (!actor || actor.role !== "owner") return { error: "Só o dono adiciona pessoas.", created: null };
  const input = NewMember.safeParse({
    name: form.get("name"),
    email: form.get("email"),
    role: form.get("role"),
    unitId: form.get("unitId"),
    barberId: form.get("barberId") || undefined,
  });
  if (!input.success) return { error: "Preencha nome, e-mail válido, função e unidade.", created: null };
  if ((await listStaff()).some((x) => x.email.toLowerCase() === input.data.email.toLowerCase())) return { error: "Já existe alguém com esse e-mail.", created: null };
  if (input.data.role === "barber" && !input.data.barberId) return { error: "Escolha qual barbeiro é essa pessoa.", created: null };
  const { member, tempPassword } = await createStaff({
    name: input.data.name,
    email: input.data.email,
    role: input.data.role as Role,
    unitIds: [input.data.unitId],
    barberId: input.data.role === "barber" ? (input.data.barberId ?? null) : null,
  });
  await audit(actor, member, `Criado como ${ROLE_LABEL[member.role]}`);
  revalidatePath("/painel", "layout");
  return {
    error: null,
    created: staffLoginEnabled() ? `${member.name} criado. Senha provisória: ${tempPassword} (mostrada só agora).` : `${member.name} criado. O login da equipe fica disponível quando STAFF_LOGIN estiver ligado.`,
  };
}
