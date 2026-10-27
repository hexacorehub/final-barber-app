import "server-only";
import { writeText, type ModelCall, type WriteRequest, type Written } from "@/domain/assistants/writer";

/**
 * Which model rewrites the assistants' texts. Off by default (AI_PROVIDER unset or "none"):
 * everything stays on rules at no cost. Set AI_PROVIDER=gemini (with GEMINI_API_KEY and
 * AI_MODEL) or AI_PROVIDER=anthropic (with ANTHROPIC_API_KEY; AI_MODEL defaults to
 * claude-haiku-5-5). Gemini's free tier may use what it receives to train models: use it only
 * with the demo's made-up data.
 */
export function aiProvider(): "none" | "gemini" | "anthropic" {
  const p = process.env.AI_PROVIDER;
  if (p === "gemini" && process.env.GEMINI_API_KEY && process.env.AI_MODEL) return "gemini";
  if (p === "anthropic" && process.env.ANTHROPIC_API_KEY) return "anthropic";
  return "none";
}

function modelCall(): ModelCall | null {
  const provider = aiProvider();
  if (provider === "gemini") {
    return async (prompt, signal) => {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${process.env.AI_MODEL}:generateContent`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY! },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        signal,
      });
      if (!res.ok) throw new Error(`gemini ${res.status}`);
      const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      return data.candidates?.[0]?.content?.parts?.map((x) => x.text ?? "").join("") ?? "";
    };
  }
  if (provider === "anthropic") {
    return async (prompt, signal) => {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY!, "anthropic-version": "2023-06-01" },
        body: JSON.stringify({ model: process.env.AI_MODEL || "claude-haiku-5-5", max_tokens: 300, messages: [{ role: "user", content: prompt }] }),
        signal,
      });
      if (!res.ok) throw new Error(`anthropic ${res.status}`);
      const data = (await res.json()) as { content?: { type: string; text?: string }[] };
      return data.content?.filter((x) => x.type === "text").map((x) => x.text ?? "").join("") ?? "";
    };
  }
  return null;
}

export function write(r: WriteRequest): Promise<Written> {
  return writeText(r, modelCall());
}
