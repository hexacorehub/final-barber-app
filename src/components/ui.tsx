import type { ReactNode } from "react";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...parts: Parameters<typeof clsx>): string {
  return twMerge(clsx(parts));
}

export const buttonStyles = {
  primary:
    "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-ink px-5 text-[15px] font-semibold text-white hover:bg-ink-soft disabled:cursor-not-allowed disabled:bg-track disabled:text-muted",
  secondary:
    "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-ink bg-white px-5 text-[15px] font-semibold text-ink hover:bg-chip disabled:opacity-50",
  ghost: "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-3 text-sm font-medium text-ink hover:bg-chip",
  inverse:
    "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-5 text-[15px] font-semibold text-ink hover:bg-chip",
};

export function Card({ children, className, dark }: { children: ReactNode; className?: string; dark?: boolean }) {
  return <div className={cn("rounded-2xl p-5", dark ? "bg-ink text-white" : "border border-line bg-white", className)}>{children}</div>;
}

export function SectionTitle({ children, action, className }: { children: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-3", className)}>
      <h2 className="font-display text-lg font-semibold">{children}</h2>
      {action}
    </div>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("text-xs font-semibold tracking-[0.08em] text-muted uppercase", className)}>{children}</p>;
}

type Tone = "neutral" | "dark" | "ok" | "warn" | "bad";
const TONES: Record<Tone, string> = {
  neutral: "bg-chip text-ink-soft",
  dark: "bg-ink text-white",
  ok: "bg-ok-bg text-ok",
  warn: "bg-warn-bg text-warn",
  bad: "bg-bad-bg text-bad",
};

export function Badge({ children, tone = "neutral", className }: { children: ReactNode; tone?: Tone; className?: string }) {
  return <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold whitespace-nowrap", TONES[tone], className)}>{children}</span>;
}

export function Stat({ label, value, hint, dark }: { label: string; value: ReactNode; hint?: ReactNode; dark?: boolean }) {
  return (
    <Card dark={dark} className="flex flex-col gap-2">
      <span className={cn("text-[13px]", dark ? "text-[#cfcfcf]" : "text-muted")}>{label}</span>
      <span className="font-display text-[30px] leading-none font-medium whitespace-nowrap tracking-normal normal-case">{value}</span>
      {hint ? <span className={cn("text-[13px]", dark ? "text-[#cfcfcf]" : "text-muted")}>{hint}</span> : null}
    </Card>
  );
}

/** Thin horizontal meter, 0–1. */
export function Meter({ value, className, label }: { value: number; className?: string; label: string }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} className={cn("h-1.5 overflow-hidden rounded-full bg-track", className)}>
      <div className="h-full rounded-full bg-ink" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function Placeholder({ label, className, dark }: { label: string; className?: string; dark?: boolean }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 rounded-2xl text-[13px]", dark ? "bg-[#1f1f1f] text-[#a8a8a8]" : "bg-chip text-faint", className)}>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
        <circle cx="12" cy="13" r="3.5" />
      </svg>
      <span>{label}</span>
    </div>
  );
}
