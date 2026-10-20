"use client";

import { useState } from "react";
import { Check, Copy, MessageCircle } from "lucide-react";
import { buttonStyles, cn } from "@/components/ui";

export function ShareButtons({ link, message }: { link: string; message: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <a href={`https://wa.me/?text=${encodeURIComponent(`${message} ${link}`)}`} target="_blank" rel="noreferrer" className={buttonStyles.inverse}>
        <MessageCircle size={18} aria-hidden="true" /> Enviar no WhatsApp
      </a>
      <button type="button" onClick={copy} className={cn(buttonStyles.secondary, "border-white bg-transparent text-white hover:bg-white/10")}>
        {copied ? <Check size={18} aria-hidden="true" /> : <Copy size={18} aria-hidden="true" />} {copied ? "Link copiado" : "Copiar link"}
      </button>
    </div>
  );
}
