import { describe, expect, it } from "vitest";
import { ask, readPeriod } from "@/domain/assistants/ask";
import { scoreboard, demoActionLog } from "@/domain/assistants/scoreboard";
import { weeklyBrief } from "@/domain/assistants/weekly-brief";
import { keepsNumbers, writeText } from "@/domain/assistants/writer";
import { revenueMix } from "@/domain/metrics";
import { formatMoneyRound } from "@/domain/money";
import { buildDemoSnapshot } from "@/server/data/demo-dataset";

const s = buildDemoSnapshot(new Date("2026-10-27T15:00:00Z"));

describe("Perguntar", () => {
  it("reads the metric, period and unit", () => {
    const a = ask(s, "Quanto faturamos na Guarapiranga no mês passado?");
    expect(a.intent).toBe("revenue");
    expect(a.understood).toContain("Guarapiranga");
    expect(a.understood).toContain("mês passado");
  });

  it("answers with the same number as the dashboard", () => {
    const p = readPeriod("este mes", s.now);
    const a = ask(s, "quanto faturamos este mês?");
    expect(a.title).toContain(formatMoneyRound(revenueMix(s, p).totalCents));
  });

  it("knows several kinds of question and admits when it does not understand", () => {
    expect(ask(s, "quem mais vendeu plano?").intent).toBe("plans_sold");
    expect(ask(s, "quantas faltas na semana").intent).toBe("no_shows");
    expect(ask(s, "quantos cancelaram nos últimos 30 dias").intent).toBe("cancellations");
    expect(ask(s, "quem pode assinar o clube").intent).toBe("candidates");
    expect(ask(s, "qual a cor do céu").intent).toBe("unknown");
  });
});

describe("text writer", () => {
  const req = { task: "teste", fallback: "Faturou R$ 1.250, 12% a mais.", numbers: ["R$ 1.250", "12%"] };
  it("stays on rules with no model", async () => {
    expect(await writeText(req, null)).toEqual({ text: req.fallback, engine: "rules" });
  });
  it("accepts a rewrite that keeps the numbers and refuses one that changes them", async () => {
    expect((await writeText(req, async () => "A semana rendeu R$ 1.250, alta de 12%.")).engine).toBe("ai");
    expect((await writeText(req, async () => "A semana rendeu R$ 1.300, alta de 12%.")).text).toBe(req.fallback);
    expect((await writeText(req, async () => Promise.reject(new Error("down")))).engine).toBe("rules");
    expect(keepsNumbers("R$ 1.250 e 12%", req.numbers)).toBe(true);
  });
});

describe("weekly brief and scoreboard", () => {
  it("quotes its numbers in the headline", () => {
    const b = weeklyBrief(s);
    expect(keepsNumbers(b.headline, b.numbers)).toBe(true);
    expect(b.priorities.length).toBeLessThanOrEqual(3);
  });

  it("only counts what happened after the message", () => {
    const board = scoreboard(s, demoActionLog(s));
    expect(board.sent).toBeGreaterThan(0);
    expect(board.results).toBeLessThanOrEqual(board.sent);
    for (const x of board.items.filter((i) => i.outcome === "subscribed")) {
      const sub = s.subscriptions.find((y) => y.customerId === x.action.customerId)!;
      expect(sub.startedAt >= x.action.at.slice(0, 10)).toBe(true);
    }
  });
});
