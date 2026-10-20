import { cn } from "./ui";

/** Simple mustache mark. Replace with the shop's real logo file when available. */
export function MustacheMark({ className, color = "currentColor" }: { className?: string; color?: string }) {
  return (
    <svg viewBox="0 0 34 20" className={cn("h-5 w-[34px]", className)} aria-hidden="true">
      <path d="M1 11c4 1 7-6 12-6 2 0 3 1.4 4 1.4S19 5 21 5c5 0 8 7 12 6-2 4-8 5-12 3-2-1-3-2.4-4-2.4S15 13 13 14c-4 2-10 1-12-3z" fill={color} />
    </svg>
  );
}

export function Wordmark({ className, name = "Mister Bigode" }: { className?: string; name?: string }) {
  return (
    <span className={cn("flex items-center gap-2.5", className)}>
      <MustacheMark />
      <span className="font-display text-[19px] font-semibold tracking-[0.12em]">{name}</span>
    </span>
  );
}
