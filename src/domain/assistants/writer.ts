/**
 * The text writer behind the assistants. Rules always produce a text; a model may rewrite it
 * when one is configured, under two guards: it must keep every number the rules quoted, and
 * it must answer in time. Otherwise the rule text is used. The model never sees anything but
 * the facts already shown on screen, and never decides a number.
 */

export interface WriteRequest {
  /** What the text is for, e.g. "resumo da semana para o dono". */
  task: string;
  /** The rule text: the fallback, and the content the model rewrites. */
  fallback: string;
  /** Numbers as printed (R$ 1.250, 12%, 3) that must survive the rewrite. */
  numbers: string[];
}

export interface Written {
  text: string;
  engine: "rules" | "ai";
}

export type ModelCall = (prompt: string, signal: AbortSignal) => Promise<string>;

export function keepsNumbers(text: string, numbers: string[]): boolean {
  const norm = (x: string) => x.replace(/\s/g, " ");
  return numbers.every((n) => norm(text).includes(norm(n)));
}

export function promptFor(r: WriteRequest): string {
  return [
    `Você escreve textos curtos em português do Brasil para o painel de uma barbearia. Tarefa: ${r.task}.`,
    "Reescreva o texto abaixo com naturalidade, no máximo 2 frases, sem inventar fatos.",
    `Mantenha exatamente estes números, como estão escritos: ${r.numbers.join(" | ")}.`,
    "Responda só com o texto.",
    "",
    r.fallback,
  ].join("\n");
}

export async function writeText(r: WriteRequest, call: ModelCall | null, timeoutMs = 4000): Promise<Written> {
  if (!call) return { text: r.fallback, engine: "rules" };
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const out = (await call(promptFor(r), ctrl.signal)).trim();
    if (!out || out.length > r.fallback.length * 2 + 200 || !keepsNumbers(out, r.numbers)) return { text: r.fallback, engine: "rules" };
    return { text: out, engine: "ai" };
  } catch {
    return { text: r.fallback, engine: "rules" };
  } finally {
    clearTimeout(timer);
  }
}
