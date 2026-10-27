import type { Metadata } from "next";
import { Empty, PageHeader, Panel } from "@/components/dashboard";
import { NoAccess } from "@/components/no-access";
import { Badge } from "@/components/ui";
import { can, OWNER_ONLY, PERMISSIONS, permissionsOf, ROLE_LABEL, ROLE_TEMPLATES } from "@/domain/access";
import { shortDate } from "@/domain/time";
import { loadSnapshot } from "@/server/data/store";
import { currentStaff, listAudit, listStaff, staffLoginEnabled } from "@/server/staff";
import { ActiveToggle, AddMemberForm, GrantSelect } from "./access-editor";

export const metadata: Metadata = { title: "Equipe e acessos" };

export default async function TeamPage() {
  const staff = (await currentStaff())!;
  if (can(staff, "team") !== "all") {
    return (
      <>
        <PageHeader title="Equipe e acessos" path="/painel/equipe" />
        <NoAccess what="equipe e acessos" />
      </>
    );
  }
  const s = await loadSnapshot();
  const team = await listStaff();
  const log = await listAudit();
  const unitName = (id: string) => s.units.find((u) => u.id === id)?.name ?? id;

  return (
    <>
      <PageHeader title="Equipe e acessos" path="/painel/equipe">
        <p className="mt-1 max-w-2xl text-sm text-muted">
          Cada pessoa começa com o mínimo para o trabalho dela, só nas unidades em que atua. Ligue o que for preciso, por pessoa. Equipe e regras do clube são sempre só do dono.
          {staffLoginEnabled() ? "" : " O login da equipe por e-mail e senha está desligado (STAFF_LOGIN); na demonstração, use \"Ver como\" no topo."}
        </p>
      </PageHeader>

      {team.length ? (
        team.map((m) => {
          const eff = permissionsOf(m);
          return (
            <Panel
              key={m.id}
              title={m.name}
              note={`${ROLE_LABEL[m.role]} · ${m.unitIds.map(unitName).join(", ") || "todas as unidades"}${m.barberId ? ` · barbeiro ${s.barbers.find((b) => b.id === m.barberId)?.name ?? ""}` : ""} · ${m.email}`}
              action={
                <div className="flex items-center gap-2">
                  {m.active ? <Badge tone="ok">Ativo</Badge> : <Badge>Desligado</Badge>}
                  <ActiveToggle staffId={m.id} active={m.active} />
                </div>
              }
            >
              <ul className="grid gap-x-8 md:grid-cols-2">
                {PERMISSIONS.map((p) => {
                  const locked = OWNER_ONLY.includes(p.key);
                  const isDefault = !(p.key in m.overrides);
                  return (
                    <li key={p.key} className="flex items-center justify-between gap-3 border-b border-line-soft px-5 py-2.5 text-sm">
                      <span className="flex min-w-0 flex-col">
                        <span className="font-semibold">{p.label}</span>
                        <span className="text-xs text-muted">{locked ? "Só o dono, não pode ser liberado" : isDefault ? `${p.detail} · padrão da função` : `${p.detail} · alterado pelo dono`}</span>
                      </span>
                      <GrantSelect staffId={m.id} permission={p.key} value={eff[p.key]} isDefault={isDefault} defaultGrant={ROLE_TEMPLATES[m.role][p.key]} scoped={p.scoped} locked={locked} />
                    </li>
                  );
                })}
              </ul>
            </Panel>
          );
        })
      ) : (
        <Empty>Ninguém na equipe ainda.</Empty>
      )}

      <Panel title="Adicionar pessoa" note="Ela entra com a função escolhida e o acesso mínimo; depois você ajusta acima.">
        <AddMemberForm units={s.units.map((u) => ({ id: u.id, name: u.name }))} barbers={s.barbers.filter((b) => b.active).map((b) => ({ id: b.id, name: b.name }))} />
      </Panel>

      <Panel title="Histórico de acessos" note="Quem mudou o quê, e quando">
        {log.length ? (
          <ul className="flex flex-col divide-y divide-line-soft">
            {log.map((l) => (
              <li key={l.id} className="flex flex-wrap gap-3 px-5 py-2.5 text-sm">
                <span className="w-16 text-muted">{shortDate(l.at.slice(0, 10))}</span>
                <span className="font-semibold">{l.actor}</span>
                <span className="text-muted">→ {l.target}:</span>
                <span>{l.change}</span>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>Nenhuma mudança de acesso registrada ainda.</Empty>
        )}
      </Panel>
    </>
  );
}
