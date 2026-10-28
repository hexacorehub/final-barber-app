"use client";

import type { ReactNode } from "react";
import { trackAssistantAction } from "@/server/assistants/actions";

/** A link that also tells the assistant's scoreboard the owner acted on a suggestion. */
export function TrackedLink({ href, className, kind, customerId, children }: { href: string; className?: string; kind: string; customerId: string; children: ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={className}
      onClick={() => {
        void trackAssistantAction({ kind, customerId }).catch(() => undefined);
      }}
    >
      {children}
    </a>
  );
}
