import { describe, expect, it } from "vitest";
import { bestPlanFor, candidateInsights, candidateScore, chanceFor, clubCandidates, segmentFor } from "@/domain/assistants/candidates";
import { visitStats, type VisitStats } from "@/domain/assistants/history";
import { frontDeskTime, outboxToday, outboxVolume30d, SITUATIONS } from "@/domain/assistants/outbox";
import { ownerDay } from "@/domain/assistants/owner-actions";
import { candidateReason, inviteMessage, namesFor, pick } from "@/domain/assistants/phrases";
import { formatMoneyRound } from "@/domain/money";
import { addDays, dayKey } from "@/domain/time";
import { PLANS } from "@/server/data/catalog";
import { buildDemoSnapshot, DEMO_CUSTOMER_ID, DEMO_DEPENDENT_ID } from "@/server/data/demo-dataset";

const NOW = new Date("2026-10-27T15:00:00Z"); // 12:00 in São Paulo, a Tuesday
const s = buildDemoSnapshot(NOW);

const stats = (over: Partial<VisitStats>): VisitStats => ({
  customerId: "x",
  visits: 6,
  spanDays: 90,
  visitsPerMonth: 2,
  lastVisit: "2026-10-20",
  daysSinceLast: 7,
  avgGapDays: 15,
  gapVariation: 0.1,
  mainBarberId: "b1",
  mainBarberShare: 1,
  next: null,
  coverableMonthlyCents: { haircut: 16000, beard: 0 },
  avgCoverableVisitCents: 8000,
  ...over,
});

describe("plan choice for a candidate", () => {
  const plans = [...PLANS].sort((a, b) => a.priceCents - b.priceCents);

  it("compares each plan with what it leaves out, not only plans that cover everything", () => {
    // 2 cuts and 1 beard a month: Corte Plus + the beard paid apart beats C+B Plus.
    const best = bestPlanFor(plans, stats({ coverableMonthlyCents: { haircut: 16000, beard: 6500 } }))!;
    expect(best.plan.id).toBe("plan-haircut-plus");
    expect(best.inPlanCents).toBe(14999 + 6500);
    expect(best.savingCents).toBe(22500 - 21499);
  });

  it("ignores plans that cover nothing the person does", () => {
    const best = bestPlanFor(plans, stats({ coverableMonthlyCents: { haircut: 0, beard: 13000 } }))!;
    expect(best.plan.covers).toContain("beard");
  });

  it("segments by the real difference", () => {
    expect(segmentFor(5000, 20000, 8000)).toBe("saves");
    expect(segmentFor(1000, 16000, 8000)).toBe("even");
    expect(segmentFor(-1000, 16000, 8000)).toBe("even");
    expect(segmentFor(-6000, 9000, 8000)).toBe("near");
    expect(segmentFor(-9000, 6000, 8000)).toBeNull();
  });

  it("scores savings, frequency, regularity and recency within 0–100", () => {
    const strong = candidateScore("saves", 8000, 30000, stats({ visitsPerMonth: 3 }));
    const weak = candidateScore("near", -5000, 9000, stats({ visitsPerMonth: 1, gapVariation: 0.9, daysSinceLast: 80, avgGapDays: 30, mainBarberShare: 0.3 }));
    expect(strong).toBeGreaterThan(weak);
    expect(strong).toBeLessThanOrEqual(100);
    expect(chanceFor(strong)).toBe("alta");
    expect(chanceFor(weak)).toBe("baixa");
    // One more visit a month would be needed: never more than a low chance.
    expect(chanceFor(95, "near")).toBe("baixa");
  });
});

describe("club candidates on the demo data", () => {
  const list = clubCandidates(s);
  const members = new Set(s.subscriptions.filter((x) => x.status !== "canceled").map((x) => x.customerId));

  it("finds candidates only among people without a plan or a pending request", () => {
    expect(list.length).toBeGreaterThan(10);
    for (const c of list) {
      expect(members.has(c.customer.id)).toBe(false);
      expect(s.leads.some((l) => l.customerId === c.customer.id)).toBe(false);
      expect(c.stats.visits).toBeGreaterThanOrEqual(2);
    }
  });

  it("is ordered by score and its numbers add up", () => {
    for (let i = 1; i < list.length; i++) expect(list[i - 1].score).toBeGreaterThanOrEqual(list[i].score);
    for (const c of list) expect(c.payNowCents - c.inPlanCents).toBe(c.savingCents);
  });

  it("the insights sum the list", () => {
    const ins = candidateInsights(s, list);
    expect(ins.candidates).toBe(list.length);
    expect(ins.bySegment.saves + ins.bySegment.even + ins.bySegment.near).toBe(list.length);
    const total = ins.potentialMrrByChance.alta + ins.potentialMrrByChance.media + ins.potentialMrrByChance.baixa;
    expect(total).toBe(list.reduce((t, c) => t + c.plan.priceCents, 0));
    expect(ins.walkInsRegular).toBeLessThanOrEqual(ins.walkInsActive);
    const week = addDays(dayKey(s.now), 6);
    for (const c of ins.comingThisWeek) expect(c.moment.day <= week).toBe(true);
  });

  it("the reason and the invitation quote the same numbers the rules found", () => {
    const n = namesFor(s);
    const c = list.find((x) => x.segment === "saves")!;
    expect(candidateReason(c, n)).toContain(formatMoneyRound(c.savingCents));
    expect(inviteMessage(c, n)).toContain(formatMoneyRound(c.savingCents));
  });

  it("says what the plan leaves out when it is paid apart", () => {
    const n = namesFor(s);
    const c = list.find((x) => x.inPlanCents > x.plan.priceCents);
    if (c) expect(candidateReason(c, n)).toContain("à parte");
  });

  it("only counts as alta or média who pays the same or less in the plan", () => {
    for (const c of list) if (c.chance !== "baixa") expect(c.segment).not.toBe("near");
  });
});

describe("whatsapp outbox", () => {
  const items = outboxToday(s);

  it("builds messages for several situations, each with a recipient and text", () => {
    const kinds = new Set(items.map((i) => i.situation));
    expect(kinds.has("reminder_eve")).toBe(true);
    expect(kinds.has("after_visit")).toBe(true);
    expect(kinds.has("card_declined")).toBe(true);
    for (const i of items) {
      expect(i.text.length).toBeGreaterThan(20);
      expect(i.text).toContain(i.to.name.split(" ")[0]);
    }
  });

  it("writes to the account holder about someone they manage, once per group", () => {
    const dep = items.filter((i) => i.about.id === DEMO_DEPENDENT_ID);
    for (const i of dep) expect(i.to.id).toBe(DEMO_CUSTOMER_ID);
    const ids = items.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("respects the daily caps", () => {
    for (const [k, info] of Object.entries(SITUATIONS)) {
      if (info.dailyCap !== null) expect(items.filter((i) => i.situation === k).length).toBeLessThanOrEqual(info.dailyCap);
    }
  });

  it("estimates front-desk time from the shop's last 30 days", () => {
    const vol = outboxVolume30d(s);
    const t = frontDeskTime(s, vol);
    expect(t.messages).toBe(vol.filter((v) => SITUATIONS[v.situation].defaultOn).reduce((x, v) => x + v.last30, 0));
    expect(t.minutes).toBeGreaterThan(t.messages);
    expect(t.whatsappBookings).toBeGreaterThan(0);
  });
});

describe("owner's day", () => {
  it("orders actions by the money involved and totals keep/win", () => {
    const day = ownerDay(s);
    expect(day.actions.length).toBeGreaterThan(0);
    for (let i = 1; i < day.actions.length; i++) expect(day.actions[i - 1].valueCents).toBeGreaterThanOrEqual(day.actions[i].valueCents);
    expect(day.keepCents).toBe(day.actions.filter((a) => a.money === "keep").reduce((t, a) => t + a.valueCents, 0));
  });
});

describe("phrases", () => {
  it("picks the same variation for the same person", () => {
    expect(pick("a-1", ["x", "y", "z"])).toBe(pick("a-1", ["x", "y", "z"]));
  });
  it("visit stats skip canceled visits", () => {
    const st = visitStats(s).get(DEMO_CUSTOMER_ID)!;
    expect(st.visits).toBeGreaterThan(0);
    expect(st.mainBarberId).toBe("barber-bigode");
  });
});

