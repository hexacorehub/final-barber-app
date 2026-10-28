"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { ArrowRight, Send } from "lucide-react";
import type { Answer } from "@/domain/assistants/ask";
import { askAssistant } from "@/server/assistants/actions";
import { cn } from "@/components/ui";

export function AskBox({ suggestions }: { suggestions: string[] }) {
  const [question, setQuestion] = useState("");
  const [answers, setAnswers] = useState<{ q: string; a: Answer }[]>([]);
  const [pending, start] = useTransition();

  const send = (q: string) => {
    const text = q.trim();
    if (!text) return;
    start(async () => {
      const a = await askAssistant(text);
      if (a) setAnswers((cur) => [{ q: text, a }, ...cur].slice(0, 4));
      setQuestion("");
    });
  };

  return (
    <div className="flex flex-col gap-4 px-5 py-4">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send(question);
        }}
      >
        <label htmlFor="ask" className="sr-only">
          Pergunta para o assistente
        </label>
        <input
          id="ask"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ex.: quanto faturamos na Guarapiranga este mês?"
          className="min-h-12 flex-1 rounded-xl border border-line px-4 text-[15px] outline-none focus:border-ink"
          maxLength={300}
        />
        <button type="submit" disabled={pending || !question.trim()} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-ink px-4 font-semibold text-white disabled:bg-track disabled:text-muted">
          <Send size={16} aria-hidden="true" />
          <span className="hidden sm:inline">{pending ? "Pensando…" : "Perguntar"}</span>
        </button>
      </form>
      <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
        {suggestions.map((s) => (
          <button key={s} type="button" disabled={pending} onClick={() => send(s)} className="shrink-0 rounded-full bg-chip px-3 py-2 text-[13px] whitespace-nowrap hover:bg-line">
            {s}
          </button>
        ))}
      </div>
      <div aria-live="polite" className="flex flex-col gap-3">
        {answers.map(({ q, a }, i) => (
          <article key={`${q}-${i}`} className={cn("flex flex-col gap-2 rounded-2xl border p-4", i === 0 ? "border-ink" : "border-line opacity-80")}>
            <p className="text-[13px] text-muted">“{q}”</p>
            <h3 className="font-display text-xl leading-tight font-semibold">{a.title}</h3>
            <p className="text-[15px] leading-relaxed text-ink-soft">{a.text}</p>
            {a.rows.length ? (
              <dl className="grid grid-cols-[1fr_auto] gap-x-6 gap-y-1 text-sm">
                {a.rows.map((r) => (
                  <div key={r.label} className="contents">
                    <dt className="text-muted">{r.label}</dt>
                    <dd className="text-right font-semibold">{r.value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
              <span>{a.understood ? `Entendi: ${a.understood}` : "Pergunta não reconhecida"}</span>
              {a.href ? (
                <Link href={a.href} className="inline-flex items-center gap-1 text-[13px] font-semibold text-ink">
                  Ver detalhes <ArrowRight size={14} aria-hidden="true" />
                </Link>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
