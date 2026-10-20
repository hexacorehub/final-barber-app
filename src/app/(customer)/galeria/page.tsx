import type { Metadata } from "next";
import { barberName, serviceNames } from "@/components/format";
import { customerSummary } from "@/domain/metrics";
import { dayKey, shortDate } from "@/domain/time";
import { loadSnapshot } from "@/server/data/store";
import { currentCustomerId } from "@/server/session";
import { Gallery } from "./gallery";

export const metadata: Metadata = { title: "Minha galeria" };

export default async function GalleryPage() {
  const s = await loadSnapshot();
  const me = customerSummary(s, await currentCustomerId());
  const visits = (me?.history ?? []).slice(0, 6).map((a) => ({
    id: a.id,
    title: serviceNames(a.serviceIds, s.services),
    detail: `${shortDate(dayKey(a.startsAt))} · ${barberName(a.barberId, s.barbers)}`,
  }));
  return (
    <div className="flex flex-col gap-5 px-5 pt-5">
      <div>
        <h1 className="font-display text-[28px] font-semibold">Minha galeria</h1>
        <p className="text-sm text-muted">Antes e depois de cada corte. Só você vê, a menos que autorize a barbearia a publicar.</p>
      </div>
      <Gallery visits={visits} />
    </div>
  );
}
