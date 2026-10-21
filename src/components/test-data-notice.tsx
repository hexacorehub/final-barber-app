import { cn } from "./ui";

/** The one disclaimer shown wherever test data is on screen. */
export const TEST_DATA_NOTICE = "Todos os dados são de teste, usados apenas para fins de teste.";

export function TestDataNotice({ className }: { className?: string }) {
  return <p className={cn("text-xs text-faint", className)}>{TEST_DATA_NOTICE}</p>;
}
