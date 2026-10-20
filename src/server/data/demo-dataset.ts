import type { Appointment, Customer, PlanLead, ProductReservation, ProductSale, Snapshot, Subscription } from "@/domain/types";
import { addDays, dayKey, fromLocal, localParts, weekdayOf } from "@/domain/time";
import { BARBERS, PLANS, PRODUCTS, SERVICES, SHOP, UNITS } from "./catalog";

/**
 * Deterministic demo history for the shop: ~800 customers, the club members, six months
 * of appointments and product sales, and the next week of bookings — all relative to `now`,
 * so the dashboards always look current. Same input → same output.
 */

export const DEMO_CUSTOMER_ID = "cust-rafael";
export const DEMO_DEPENDENT_ID = "cust-pedro";

const HISTORY_DAYS = 185;
const FUTURE_DAYS = 7;

function rng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
    chance: (p: number) => next() < p,
    pick: <T,>(items: readonly T[]) => items[Math.floor(next() * items.length)],
    weighted: <T,>(items: readonly (readonly [T, number])[]) => {
      const total = items.reduce((s, [, w]) => s + w, 0);
      let r = next() * total;
      for (const [item, w] of items) {
        if ((r -= w) < 0) return item;
      }
      return items[items.length - 1][0];
    },
  };
}

const FIRST = [
  "Lucas", "Gabriel", "Matheus", "Pedro", "Guilherme", "Rafael", "Felipe", "Bruno", "Thiago", "Gustavo", "Rodrigo", "André", "Carlos",
  "Diego", "Eduardo", "Fernando", "Henrique", "Igor", "João", "Leonardo", "Marcelo", "Nicolas", "Otávio", "Paulo", "Renato", "Samuel",
  "Tiago", "Victor", "Vinícius", "Wesley", "Arthur", "Caio", "Daniel", "Enzo", "Fábio", "Heitor", "Ícaro", "Júlio", "Kauã", "Luan",
  "Murilo", "Nathan", "Ricardo", "Sérgio", "Túlio", "Alexandre", "Bernardo", "César", "Davi", "Emanuel", "Francisco", "Hugo", "Marcos",
];
const LAST = ["Silva", "Santos", "Oliveira", "Souza", "Lima", "Pereira", "Costa", "Ferreira", "Almeida", "Ribeiro", "Carvalho", "Gomes", "Martins", "Rocha", "Araújo", "Barbosa", "Melo", "Cardoso", "Teixeira", "Moreira"];

const PLAN_WEIGHTS = [
  ["plan-cb-plus", 22],
  ["plan-haircut-plus", 20],
  ["plan-beard-plus", 8],
  ["plan-cb-premium", 28],
  ["plan-beard-premium", 7],
  ["plan-haircut-premium", 15],
] as const;

const EXTRAS = [
  ["svc-eyebrow", 4],
  ["svc-hydration", 2],
  ["svc-nose-ear-wax", 2],
  ["svc-scrub", 1],
  ["svc-pigmentation", 1],
  ["svc-neckline", 2],
] as const;

const WALK_IN_SERVICES = [
  [["svc-haircut"], 50],
  [["svc-haircut", "svc-beard"], 20],
  [["svc-beard"], 12],
  [["svc-haircut-scissor"], 6],
  [["svc-haircut-kids"], 7],
  [["svc-facial-spa"], 2],
  [["svc-straightening"], 2],
  [["svc-haircut-women"], 1],
] as const;

const PRODUCT_WEIGHTS = [
  ["prd-pomade-matte", 18],
  ["prd-pomade-shine", 9],
  ["prd-texture-powder", 7],
  ["prd-hair-tonic", 5],
  ["prd-shampoo-daily", 6],
  ["prd-beard-oil", 16],
  ["prd-beard-balm", 9],
  ["prd-beard-shampoo", 7],
  ["prd-aftershave", 5],
  ["prd-face-scrub", 3],
  ["prd-wood-comb", 6],
  ["prd-beard-kit", 4],
] as const;

const serviceById = new Map(SERVICES.map((s) => [s.id, s]));
const planById = new Map(PLANS.map((p) => [p.id, p]));
const productById = new Map(PRODUCTS.map((p) => [p.id, p]));
const unitById = new Map(UNITS.map((u) => [u.id, u]));
const FORMER_BARBER = "barber-former";
const FORMER_LEFT_DAYS_AGO = 70;

function phone(r: ReturnType<typeof rng>) {
  return `(11) 9${r.int(1000, 9999)}-${r.int(1000, 9999)}`;
}

export function buildDemoSnapshot(now: Date): Snapshot {
  const r = rng(20261020);
  const today = dayKey(now);
  const nowMin = localParts(now).minutes;
  const firstDay = addDays(today, -HISTORY_DAYS);
  const lastDay = addDays(today, FUTURE_DAYS);
  const iso = (key: string, minutes: number) => fromLocal(key, minutes).toISOString();

  const customers: Customer[] = [];
  const subscriptions: Subscription[] = [];
  const appointments: Appointment[] = [];
  const productSales: ProductSale[] = [];
  const busy: Record<string, Record<string, [number, number][]>> = {};

  const activeBarbers = BARBERS.filter((b) => b.active);
  const barbersOfUnit = (unitId: string) => activeBarbers.filter((b) => b.unitId === unitId).map((b) => b.id);

  // ---------- customers and subscriptions ----------
  customers.push(
    { id: DEMO_CUSTOMER_ID, name: "Rafael Lima", phone: "(11) 98888-1234", cycleDays: 14, preferredBarberId: "barber-bigode", createdAt: iso(addDays(today, -400), 600) },
    { id: DEMO_DEPENDENT_ID, name: "Pedro Lima", phone: "(11) 98888-1234", cycleDays: 14, preferredBarberId: "barber-markos", createdAt: iso(addDays(today, -240), 600) },
  );
  subscriptions.push(
    {
      id: "sub-rafael",
      customerId: DEMO_CUSTOMER_ID,
      payerCustomerId: DEMO_CUSTOMER_ID,
      planId: "plan-cb-plus",
      status: "active",
      startedAt: iso(addDays(today, -245), 600),
      canceledAt: null,
      billingDay: 5,
      soldByBarberId: "barber-bigode",
      channel: "counter",
    },
    {
      id: "sub-pedro",
      customerId: DEMO_DEPENDENT_ID,
      payerCustomerId: DEMO_CUSTOMER_ID,
      planId: "plan-haircut-plus",
      status: "active",
      startedAt: iso(addDays(today, -240), 600),
      canceledAt: null,
      billingDay: 5,
      soldByBarberId: "barber-bigode",
      channel: "counter",
    },
  );

  const newCustomer = (n: number, cycle: readonly [number, number]): Customer => {
    const unit = r.chance(0.55) ? "unit-chacara" : "unit-guarapiranga";
    const preferred = r.chance(0.08) ? FORMER_BARBER : r.pick(barbersOfUnit(unit));
    return {
      id: `cust-${String(n).padStart(4, "0")}`,
      name: `${r.pick(FIRST)} ${r.pick(LAST)}`,
      phone: phone(r),
      cycleDays: r.int(cycle[0], cycle[1]),
      preferredBarberId: preferred,
      createdAt: iso(addDays(today, -r.int(30, 700)), 600),
    };
  };

  let n = 1;
  // Current members.
  for (let i = 0; i < 505; i++) {
    const c = newCustomer(n++, r.weighted([[[7, 12], 3], [[12, 18], 5], [[18, 28], 2]] as const));
    customers.push(c);
    const daysAgo = Math.floor(Math.pow(r.next(), 1.6) * 540) + 1;
    const started = addDays(today, -daysAgo);
    const status = r.weighted([
      ["active", 950],
      ["past_due", 35],
      ["paused", 15],
    ] as const);
    subscriptions.push({
      id: `sub-${c.id.slice(5)}`,
      customerId: c.id,
      payerCustomerId: c.id,
      planId: r.weighted(PLAN_WEIGHTS),
      status,
      startedAt: iso(started, r.int(540, 1140)),
      canceledAt: null,
      billingDay: Math.min(28, Number(started.slice(8))),
      soldByBarberId: r.chance(0.7) ? (c.preferredBarberId === FORMER_BARBER ? r.pick(activeBarbers).id : c.preferredBarberId) : null,
      channel: r.weighted([
        ["counter", 60],
        ["whatsapp", 25],
        ["app", 15],
      ] as const),
    });
    c.createdAt = c.createdAt < iso(started, 0) ? c.createdAt : iso(started, 0);
  }
  // Families: some members are paid by another member.
  const memberSubs = subscriptions.filter((s) => s.id.startsWith("sub-0"));
  for (let i = 0; i < 28; i++) {
    const dependent = memberSubs[r.int(0, memberSubs.length - 1)];
    const payer = memberSubs[r.int(0, memberSubs.length - 1)];
    if (dependent !== payer && dependent.payerCustomerId === dependent.customerId) dependent.payerCustomerId = payer.customerId;
  }
  // Former members, canceled in the last six months.
  for (let i = 0; i < 95; i++) {
    const c = newCustomer(n++, [18, 40]);
    customers.push(c);
    const canceledDaysAgo = r.int(1, 180);
    const started = addDays(today, -(canceledDaysAgo + r.int(45, 400)));
    subscriptions.push({
      id: `sub-${c.id.slice(5)}`,
      customerId: c.id,
      payerCustomerId: c.id,
      planId: r.weighted(PLAN_WEIGHTS),
      status: "canceled",
      startedAt: iso(started, 600),
      canceledAt: iso(addDays(today, -canceledDaysAgo), 900),
      billingDay: Math.min(28, Number(started.slice(8))),
      soldByBarberId: r.chance(0.6) ? r.pick(activeBarbers).id : null,
      channel: r.chance(0.7) ? "counter" : "whatsapp",
    });
  }
  // Walk-in customers.
  for (let i = 0; i < 300; i++) customers.push(newCustomer(n++, r.chance(0.25) ? [9, 15] : [21, 60]));

  // ---------- appointments ----------
  const subsByCustomer = new Map<string, Subscription>();
  for (const s of subscriptions) subsByCustomer.set(s.customerId, s);

  const reserve = (barberId: string, day: string, desired: number, duration: number): number | null => {
    const unit = unitById.get(BARBERS.find((b) => b.id === barberId)!.unitId)!;
    const hours = unit.hours[weekdayOf(day)];
    if (!hours) return null;
    const dayBusy = ((busy[barberId] ??= {})[day] ??= []);
    const fits = (t: number) => t >= hours.open && t + duration <= hours.close && !dayBusy.some(([s, e]) => t < e && t + duration > s);
    for (let delta = 0; delta <= 12 * 60; delta += 30) {
      for (const t of [desired + delta, desired - delta]) {
        if (t % 30 === 0 && fits(t)) {
          dayBusy.push([t, t + duration]);
          return t;
        }
      }
    }
    return null;
  };

  let apptSeq = 1;
  const pushAppointment = (c: Customer, day: string, preferredMinute: number, groupId: string | null, forcedBarber?: string) => {
    if (weekdayOf(day) === 0) day = addDays(day, 1);
    const sub = subsByCustomer.get(c.id);
    const visitIso = iso(day, 600);
    const isMember = Boolean(sub && sub.startedAt <= visitIso && (!sub.canceledAt || sub.canceledAt > visitIso) && sub.status !== "paused");
    const plan = isMember ? planById.get(sub!.planId)! : null;

    let serviceIds: string[];
    if (plan) {
      serviceIds = [];
      if (plan.covers.includes("haircut")) serviceIds.push(r.chance(0.12) ? "svc-haircut-scissor" : "svc-haircut");
      if (plan.covers.includes("beard")) serviceIds.push("svc-beard");
    } else {
      serviceIds = [...r.weighted<readonly string[]>(WALK_IN_SERVICES)];
    }
    if (r.chance(0.12)) serviceIds.push(r.weighted(EXTRAS));
    if (c.id === DEMO_DEPENDENT_ID) serviceIds = ["svc-haircut"];
    if (c.id === DEMO_CUSTOMER_ID) serviceIds = ["svc-haircut", "svc-beard"];

    const formerLeft = addDays(today, -FORMER_LEFT_DAYS_AGO);
    let barberId = forcedBarber ?? c.preferredBarberId ?? r.pick(activeBarbers).id;
    if (barberId === FORMER_BARBER && day >= formerLeft) barberId = r.pick(barbersOfUnit("unit-guarapiranga"));
    if (!forcedBarber && r.chance(0.15)) barberId = r.pick(barbersOfUnit(BARBERS.find((b) => b.id === barberId)!.unitId));

    const duration = serviceIds.reduce((s, id) => s + serviceById.get(id)!.durationMin, 0);
    const start = reserve(barberId, day, preferredMinute, duration);
    if (start === null) return null;

    let charged = 0;
    let covered = 0;
    for (const id of serviceIds) {
      const svc = serviceById.get(id)!;
      if (plan && svc.coverage && plan.covers.includes(svc.coverage)) covered += svc.priceCents;
      else charged += svc.priceCents;
    }

    let status: Appointment["status"];
    const isPast = day < today || (day === today && start + duration <= nowMin);
    if (isPast) {
      status = r.weighted([
        ["completed", 940],
        ["no_show", 30],
        ["canceled", 30],
      ] as const);
    } else {
      status = "scheduled";
    }
    if (c.id === DEMO_CUSTOMER_ID || c.id === DEMO_DEPENDENT_ID) status = isPast ? "completed" : "scheduled";

    const appt: Appointment = {
      id: `appt-${String(apptSeq++).padStart(6, "0")}`,
      customerId: c.id,
      barberId,
      unitId: BARBERS.find((b) => b.id === barberId)!.unitId,
      serviceIds,
      startsAt: iso(day, start),
      durationMin: duration,
      status,
      chargedCents: charged,
      coveredCents: covered,
      subscriptionId: covered > 0 ? sub!.id : null,
      groupId,
      channel: r.weighted([
        ["app", 45],
        ["whatsapp", 35],
        ["counter", 20],
      ] as const),
    };
    appointments.push(appt);

    if (status === "completed" && r.chance(0.17)) {
      const productId = r.weighted(PRODUCT_WEIGHTS);
      const p = productById.get(productId)!;
      productSales.push({
        id: `sale-${appt.id.slice(5)}`,
        productId,
        barberId,
        customerId: c.id,
        unitId: appt.unitId,
        quantity: r.chance(0.1) ? 2 : 1,
        unitPriceCents: p.priceCents,
        soldAt: iso(day, Math.min(start + duration, 19 * 60)),
      });
    }
    return appt;
  };

  // Demo family: Rafael and Pedro come together every 14 days; last visit 12 days ago.
  for (let k = 16; k >= 0; k--) {
    const day = addDays(today, -12 - 14 * k);
    const group = `grp-rafael-${k}`;
    pushAppointment(customers[0], day, 16 * 60, group, "barber-bigode");
    pushAppointment(customers[1], day, 16 * 60, group, "barber-markos");
  }

  for (const c of customers.slice(2)) {
    const sub = subsByCustomer.get(c.id);
    const preferredMinute = r.weighted([
      [9 * 60 + 30, 2],
      [11 * 60, 3],
      [14 * 60, 3],
      [16 * 60, 3],
      [18 * 60, 4],
    ] as const);
    const isWalkIn = !sub;
    // Walk-ins come less often and some are only occasional.
    if (isWalkIn && r.chance(0.35)) {
      const visits = r.int(1, 3);
      for (let v = 0; v < visits; v++) pushAppointment(c, addDays(firstDay, r.int(0, HISTORY_DAYS)), preferredMinute, null);
      continue;
    }
    let day = addDays(firstDay, -r.int(0, c.cycleDays));
    const stopAfterCancel = sub?.canceledAt ? r.chance(0.7) : false;
    // Some members drift away: they stop visiting a few weeks ago (the "at risk" list).
    const driftsAway = sub && sub.status === "active" && r.chance(0.06);
    const driftStart = driftsAway ? addDays(today, -r.int(20, 50)) : null;
    while (day <= lastDay) {
      if (day >= firstDay) {
        const past = day < today;
        const skipFuture = !past && r.chance(0.55); // not everyone books ahead
        const afterCancel = stopAfterCancel && sub!.canceledAt! < iso(day, 0);
        const drifted = driftStart && day >= driftStart;
        if (!skipFuture && !afterCancel && !drifted) pushAppointment(c, day, preferredMinute, null);
      }
      day = addDays(day, Math.max(7, c.cycleDays + r.int(-4, 5)));
    }
  }

  // ---------- leads and reservations from the app ----------
  const walkIns = customers.filter((c) => !subsByCustomer.has(c.id));
  const leads: PlanLead[] = Array.from({ length: 7 }, (_, i) => ({
    id: `lead-${i + 1}`,
    customerId: walkIns[i * 13].id,
    planId: r.weighted(PLAN_WEIGHTS),
    createdAt: iso(addDays(today, -r.int(0, 12)), r.int(600, 1200)),
  }));
  const reservations: ProductReservation[] = Array.from({ length: 4 }, (_, i) => ({
    id: `res-${i + 1}`,
    productId: r.weighted(PRODUCT_WEIGHTS),
    customerId: customers[10 + i * 17].id,
    quantity: 1,
    status: "reserved",
    createdAt: iso(addDays(today, -r.int(0, 4)), r.int(600, 1200)),
  }));

  appointments.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  productSales.sort((a, b) => a.soldAt.localeCompare(b.soldAt));

  return {
    shop: SHOP,
    units: UNITS,
    barbers: BARBERS,
    services: SERVICES,
    plans: PLANS,
    products: PRODUCTS,
    customers,
    subscriptions,
    appointments,
    productSales,
    reservations,
    leads,
    now: now.toISOString(),
  };
}
