import type { ReactNode } from "react";
import Link from "next/link";
import type { PeriodId, Range } from "@/domain/metrics";
import { cn } from "./ui";

export const PERIODS: { id: PeriodId; label: string }[] = [
  { id: "mes", label: "Este mês" },
  { id: "30d", label: "30 dias" },
  { id: "anterior", label: "Mês anterior" },
];

export function parsePeriod(value: string | string[] | undefined): PeriodId {
  return value === "anterior" || value === "30d" ? value : "mes";
}

export function PageHeader({ title, range, path, children }: { title: string; range?: Range; path: string; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-[32px] leading-tight font-semibold">{title}</h1>
        {range ? <p className="text-sm text-muted first-letter:uppercase">{range.label}</p> : null}
        {children}
      </div>
      {range ? (
        <nav aria-label="Período" className="flex gap-1 rounded-xl bg-chip p-1">
          {PERIODS.map((p) => (
            <Link
              key={p.id}
              href={p.id === "mes" ? path : `${path}?periodo=${p.id}`}
              aria-current={range.id === p.id ? "page" : undefined}
              className={cn("flex h-9 items-center rounded-lg px-3 text-[13px] font-semibold", range.id === p.id ? "bg-ink text-white" : "text-ink-soft hover:bg-white")}
            >
              {p.label}
            </Link>
          ))}
        </nav>
      ) : null}
    </div>
  );
}

export function Panel({ title, action, children, className, note }: { title: string; action?: ReactNode; children: ReactNode; className?: string; note?: ReactNode }) {
  return (
    <section className={cn("flex min-w-0 flex-col rounded-2xl border border-line", className)}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-soft px-5 py-4">
        <div>
          <h2 className="font-display text-lg font-semibold">{title}</h2>
          {note ? <p className="text-[13px] text-muted">{note}</p> : null}
        </div>
        {action}
      </div>
      <div className="flex min-w-0 flex-col">{children}</div>
    </section>
  );
}

export interface Segment {
  value: number;
  className: string;
  label: string;
}

/** Horizontal stacked bar scaled against `max`. */
export function StackedBar({ segments, max, label }: { segments: Segment[]; max: number; label: string }) {
  const total = segments.reduce((t, s) => t + s.value, 0);
  return (
    <div role="img" aria-label={label} className="flex h-3 w-full overflow-hidden rounded-full bg-line-soft">
      {segments.map((s) =>
        s.value > 0 ? <div key={s.label} className={cn("h-full", s.className)} style={{ width: `${(s.value / Math.max(max, total, 1)) * 100}%` }} /> : null,
      )}
    </div>
  );
}

export function Legend({ items }: { items: { label: string; className: string }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span className={cn("size-2.5 rounded-sm", i.className)} aria-hidden="true" />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

export const SOURCE_SEGMENTS = {
  walkIn: { label: "Serviços avulsos", className: "bg-src-walkin" },
  club: { label: "Mister Club", className: "bg-src-club" },
  product: { label: "Produtos", className: "bg-src-product" },
};

/** Simple table with a horizontal scroll box on small screens. */
export function DataTable({ head, children, minWidth = 640 }: { head: ReactNode; children: ReactNode; minWidth?: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm" style={{ minWidth }}>
        <thead>
          <tr className="text-left text-xs tracking-[0.06em] text-muted uppercase [&>th]:px-4 [&>th]:py-3 [&>th]:font-semibold [&>th:first-child]:pl-5 [&>th:last-child]:pr-5">
            {head}
          </tr>
        </thead>
        <tbody className="[&>tr]:border-t [&>tr]:border-line-soft [&_td]:px-4 [&_td]:py-3 [&_td:first-child]:pl-5 [&_td:last-child]:pr-5">{children}</tbody>
      </table>
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="px-5 py-6 text-sm text-muted">{children}</p>;
}
