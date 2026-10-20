import type {
  Appointment,
  Barber,
  Customer,
  Plan,
  PlanLead,
  Product,
  ProductReservation,
  ProductSale,
  Service,
  Shop,
  Subscription,
  Unit,
} from "@/domain/types";

/** Mapping between domain objects (camelCase) and Supabase rows (snake_case). */

type Row = Record<string, unknown>;
const num = (v: unknown) => Number(v);

export const shopToRow = (s: Shop): Row => ({
  id: 1,
  name: s.name,
  tagline: s.tagline,
  instagram: s.instagram,
  member_count_label: s.memberCountLabel,
  rating_label: s.ratingLabel,
});
export const shopFromRow = (r: Row): Shop => ({
  name: String(r.name),
  tagline: String(r.tagline),
  instagram: String(r.instagram),
  memberCountLabel: String(r.member_count_label),
  ratingLabel: String(r.rating_label),
});

export const unitToRow = (u: Unit): Row => ({ id: u.id, name: u.name, address: u.address, phone: u.phone, hours: u.hours });
export const unitFromRow = (r: Row): Unit => ({
  id: String(r.id),
  name: String(r.name),
  address: String(r.address),
  phone: (r.phone as string | null) ?? null,
  hours: r.hours as Unit["hours"],
});

export const barberToRow = (b: Barber): Row => ({
  id: b.id,
  name: b.name,
  unit_id: b.unitId,
  active: b.active,
  service_commission: b.serviceCommission,
  product_commission: b.productCommission,
});
export const barberFromRow = (r: Row): Barber => ({
  id: String(r.id),
  name: String(r.name),
  unitId: String(r.unit_id),
  active: Boolean(r.active),
  serviceCommission: num(r.service_commission),
  productCommission: num(r.product_commission),
});

export const serviceToRow = (s: Service): Row => ({
  id: s.id,
  name: s.name,
  category: s.category,
  duration_min: s.durationMin,
  price_cents: s.priceCents,
  coverage: s.coverage,
  bookable: s.bookable,
});
export const serviceFromRow = (r: Row): Service => ({
  id: String(r.id),
  name: String(r.name),
  category: r.category as Service["category"],
  durationMin: num(r.duration_min),
  priceCents: num(r.price_cents),
  coverage: (r.coverage as Service["coverage"]) ?? null,
  bookable: Boolean(r.bookable),
});

export const planToRow = (p: Plan): Row => ({
  id: p.id,
  name: p.name,
  tier: p.tier,
  covers: p.covers,
  price_cents: p.priceCents,
  highlight: p.highlight,
  benefits: p.benefits,
  sort_order: p.sortOrder,
});
export const planFromRow = (r: Row): Plan => ({
  id: String(r.id),
  name: String(r.name),
  tier: r.tier as Plan["tier"],
  covers: r.covers as Plan["covers"],
  priceCents: num(r.price_cents),
  highlight: (r.highlight as Plan["highlight"]) ?? null,
  benefits: (r.benefits as string[]) ?? [],
  sortOrder: num(r.sort_order),
});

export const productToRow = (p: Product): Row => ({
  id: p.id,
  name: p.name,
  category: p.category,
  description: p.description,
  price_cents: p.priceCents,
  cost_cents: p.costCents,
  stock: p.stock,
  min_stock: p.minStock,
  active: p.active,
});
export const productFromRow = (r: Row): Product => ({
  id: String(r.id),
  name: String(r.name),
  category: r.category as Product["category"],
  description: String(r.description ?? ""),
  priceCents: num(r.price_cents),
  costCents: num(r.cost_cents),
  stock: num(r.stock),
  minStock: num(r.min_stock),
  active: Boolean(r.active),
});

export const customerToRow = (c: Customer): Row => ({
  id: c.id,
  name: c.name,
  phone: c.phone,
  cycle_days: c.cycleDays,
  preferred_barber_id: c.preferredBarberId,
  created_at: c.createdAt,
});
export const customerFromRow = (r: Row): Customer => ({
  id: String(r.id),
  name: String(r.name),
  phone: String(r.phone),
  cycleDays: num(r.cycle_days),
  preferredBarberId: (r.preferred_barber_id as string | null) ?? null,
  createdAt: new Date(String(r.created_at)).toISOString(),
});

export const subscriptionToRow = (s: Subscription): Row => ({
  id: s.id,
  customer_id: s.customerId,
  payer_customer_id: s.payerCustomerId,
  plan_id: s.planId,
  status: s.status,
  started_at: s.startedAt,
  canceled_at: s.canceledAt,
  billing_day: s.billingDay,
  sold_by_barber_id: s.soldByBarberId,
  channel: s.channel,
});
export const subscriptionFromRow = (r: Row): Subscription => ({
  id: String(r.id),
  customerId: String(r.customer_id),
  payerCustomerId: String(r.payer_customer_id),
  planId: String(r.plan_id),
  status: r.status as Subscription["status"],
  startedAt: new Date(String(r.started_at)).toISOString(),
  canceledAt: r.canceled_at ? new Date(String(r.canceled_at)).toISOString() : null,
  billingDay: num(r.billing_day),
  soldByBarberId: (r.sold_by_barber_id as string | null) ?? null,
  channel: r.channel as Subscription["channel"],
});

export const appointmentToRow = (a: Appointment): Row => ({
  id: a.id,
  customer_id: a.customerId,
  barber_id: a.barberId,
  unit_id: a.unitId,
  service_ids: a.serviceIds,
  starts_at: a.startsAt,
  duration_min: a.durationMin,
  status: a.status,
  charged_cents: a.chargedCents,
  covered_cents: a.coveredCents,
  subscription_id: a.subscriptionId,
  group_id: a.groupId,
  channel: a.channel,
});
export const appointmentFromRow = (r: Row): Appointment => ({
  id: String(r.id),
  customerId: String(r.customer_id),
  barberId: String(r.barber_id),
  unitId: String(r.unit_id),
  serviceIds: r.service_ids as string[],
  startsAt: new Date(String(r.starts_at)).toISOString(),
  durationMin: num(r.duration_min),
  status: r.status as Appointment["status"],
  chargedCents: num(r.charged_cents),
  coveredCents: num(r.covered_cents),
  subscriptionId: (r.subscription_id as string | null) ?? null,
  groupId: (r.group_id as string | null) ?? null,
  channel: r.channel as Appointment["channel"],
});

export const saleToRow = (s: ProductSale): Row => ({
  id: s.id,
  product_id: s.productId,
  barber_id: s.barberId,
  customer_id: s.customerId,
  unit_id: s.unitId,
  quantity: s.quantity,
  unit_price_cents: s.unitPriceCents,
  sold_at: s.soldAt,
});
export const saleFromRow = (r: Row): ProductSale => ({
  id: String(r.id),
  productId: String(r.product_id),
  barberId: (r.barber_id as string | null) ?? null,
  customerId: (r.customer_id as string | null) ?? null,
  unitId: String(r.unit_id),
  quantity: num(r.quantity),
  unitPriceCents: num(r.unit_price_cents),
  soldAt: new Date(String(r.sold_at)).toISOString(),
});

export const reservationToRow = (x: ProductReservation): Row => ({
  id: x.id,
  product_id: x.productId,
  customer_id: x.customerId,
  quantity: x.quantity,
  status: x.status,
  created_at: x.createdAt,
});
export const reservationFromRow = (r: Row): ProductReservation => ({
  id: String(r.id),
  productId: String(r.product_id),
  customerId: String(r.customer_id),
  quantity: num(r.quantity),
  status: r.status as ProductReservation["status"],
  createdAt: new Date(String(r.created_at)).toISOString(),
});

export const leadToRow = (l: PlanLead): Row => ({ id: l.id, customer_id: l.customerId, plan_id: l.planId, created_at: l.createdAt });
export const leadFromRow = (r: Row): PlanLead => ({
  id: String(r.id),
  customerId: String(r.customer_id),
  planId: String(r.plan_id),
  createdAt: new Date(String(r.created_at)).toISOString(),
});
