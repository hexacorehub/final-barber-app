import type { ReactNode } from "react";
import { MessageCircle, Sparkles } from "lucide-react";
import { cn } from "./ui";
import { whatsappMessage } from "./whatsapp";
import { TrackedLink } from "./tracked-link";

/**
 * Marks what an assistant produced. "rules" = decided and written by rules over the shop's own
 * numbers; "ai" = the text was written by a model from those same numbers (it never changes them).
 */
export function AssistantTag({ engine = "rules", className }: { engine?: "rules" | "ai"; className?: string }) {
  return (
    <span
      title={
        engine === "ai"
          ? "Texto escrito por IA a partir dos números da barbearia. Os números são calculados pelo app e conferidos."
          : "Montado pelo assistente com regras sobre os números da barbearia: histórico de visitas, planos e agenda."
      }
      className={cn("inline-flex shrink-0 items-center gap-1 rounded-full bg-ink px-2.5 py-1 text-[11px] font-semibold tracking-wide text-white", className)}
    >
      <Sparkles size={12} aria-hidden="true" />
      {engine === "ai" ? "Assistente · IA" : "Assistente"}
    </span>
  );
}

/** What the assistant concluded, in a sentence or two, above the numbers it is based on. */
export function AssistantSays({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex gap-3 rounded-2xl border-[1.5px] border-ink bg-white p-4 md:p-5", className)}>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ink text-white">
        <Sparkles size={17} aria-hidden="true" />
      </span>
      <div className="flex min-w-0 flex-col gap-1.5 text-[15px] leading-relaxed">{children}</div>
    </div>
  );
}

/** Opens the message in WhatsApp. With `track`, the assistant's scoreboard counts it. */
export function WhatsAppButton({
  phone,
  text,
  label = "Abrir no WhatsApp",
  className,
  track,
}: {
  phone: string;
  text: string;
  label?: string;
  className?: string;
  track?: { kind: string; customerId: string };
}) {
  const style = cn("inline-flex min-h-10 items-center gap-1.5 rounded-lg border-[1.5px] border-ink px-3 text-[13px] font-semibold whitespace-nowrap hover:bg-chip", className);
  const body = (
    <>
      <MessageCircle size={15} aria-hidden="true" /> {label}
    </>
  );
  if (track) {
    return (
      <TrackedLink href={whatsappMessage(phone, text)} className={style} kind={track.kind} customerId={track.customerId}>
        {body}
      </TrackedLink>
    );
  }
  return (
    <a href={whatsappMessage(phone, text)} target="_blank" rel="noreferrer" className={style}>
      {body}
    </a>
  );
}

/** A message as it will look in the customer's WhatsApp. */
export function MessageBubble({ text, className }: { text: string; className?: string }) {
  return <p className={cn("max-w-[520px] rounded-2xl rounded-tl-sm bg-chip px-3.5 py-2.5 text-[13.5px] leading-relaxed text-ink-soft", className)}>{text}</p>;
}
