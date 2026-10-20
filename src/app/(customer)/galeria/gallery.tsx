"use client";

import { useEffect, useRef, useState } from "react";
import { Camera } from "lucide-react";
import { Placeholder, cn } from "@/components/ui";

type Side = "before" | "after";

/** Photos stay on this device in the MVP (preview only); storage comes with Supabase Storage. */
export function Gallery({ visits }: { visits: { id: string; title: string; detail: string }[] }) {
  const [side, setSide] = useState<Record<string, Side>>({});
  const [photos, setPhotos] = useState<Record<string, string>>({});
  const input = useRef<HTMLInputElement>(null);
  const target = useRef<string | null>(null);

  useEffect(() => () => Object.values(photos).forEach((u) => URL.revokeObjectURL(u)), []); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (key: string) => {
    target.current = key;
    input.current?.click();
  };

  return (
    <div className="flex flex-col gap-4">
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="sr-only"
        aria-label="Escolher foto"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && target.current) {
            const url = URL.createObjectURL(file);
            setPhotos((p) => ({ ...p, [target.current!]: url }));
          }
          e.target.value = "";
        }}
      />
      {visits.length === 0 ? <p className="rounded-xl bg-chip p-4 text-sm text-muted">Depois do seu primeiro corte, as fotos aparecem aqui.</p> : null}
      {visits.map((v) => {
        const current = side[v.id] ?? "after";
        const key = `${v.id}:${current}`;
        return (
          <article key={v.id} className="overflow-hidden rounded-2xl border border-line">
            <div className="relative">
              {photos[key] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photos[key]} alt={`${current === "after" ? "Depois" : "Antes"} do corte`} className="h-64 w-full object-cover" />
              ) : (
                <Placeholder label={current === "after" ? "Foto depois do corte" : "Foto antes do corte"} className={cn("h-64 rounded-none", current === "after" && "bg-[#e9e9e9]")} />
              )}
              <span className="absolute top-3 left-3 rounded-md bg-ink px-2 py-1 text-[11px] font-semibold tracking-[0.08em] text-white">{current === "after" ? "DEPOIS" : "ANTES"}</span>
              <button type="button" onClick={() => pick(key)} className="absolute right-3 bottom-3 flex min-h-11 items-center gap-1.5 rounded-full bg-white px-4 text-[13px] font-semibold shadow">
                <Camera size={16} aria-hidden="true" /> {photos[key] ? "Trocar" : "Adicionar"}
              </button>
            </div>
            <div className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{v.title}</p>
                <p className="text-xs text-muted">{v.detail}</p>
              </div>
              <div className="flex shrink-0 gap-1 rounded-xl bg-chip p-1">
                {(["before", "after"] as const).map((sd) => (
                  <button
                    key={sd}
                    type="button"
                    aria-pressed={current === sd}
                    onClick={() => setSide((x) => ({ ...x, [v.id]: sd }))}
                    className={cn("h-9 rounded-lg px-3 text-[13px] font-semibold", current === sd ? "bg-ink text-white" : "text-ink-soft")}
                  >
                    {sd === "before" ? "Antes" : "Depois"}
                  </button>
                ))}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
