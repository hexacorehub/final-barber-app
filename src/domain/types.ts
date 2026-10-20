/** Domain types shared by the customer app, the owner dashboard and the data stores. Money is always in cents. */

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0 = Sunday

export interface OpeningHours {
  /** Minutes after midnight (São Paulo time). */
  open: number;
  close: number;
}

export interface Shop {
  name: string;
  tagline: string;
  instagram: string;
  /** Number shown as social proof, e.g. "+500 membros". */
  memberCountLabel: string;
  ratingLabel: string;
}

export interface Unit {
  id: string;
  name: string;
  address: string;
  phone: string | null;
  /** Indexed by weekday; null = closed. */
  hours: (OpeningHours | null)[];
}

export interface Barber {
  id: string;
  name: string;
  unitId: string;
  active: boolean;
  /** Share of the service revenue paid to the barber (0–1). */
  serviceCommission: number;
  /** Share of the product revenue paid to the barber (0–1). */
  productCommission: number;
}

export type ServiceCategory = "hair" | "beard" | "treatment" | "finishing";

/** What a club plan can cover. */
export type ClubCoverage = "haircut" | "beard";

export interface Service {
  id: string;
  name: string;
  category: ServiceCategory;
  durationMin: number;
  priceCents: number;
  /** Set when a club plan with this coverage includes the service. */
  coverage: ClubCoverage | null;
  bookable: boolean;
}

export type PlanTier = "plus" | "premium";

export interface Plan {
  id: string;
  name: string;
  tier: PlanTier;
  covers: ClubCoverage[];
  priceCents: number;
  highlight: "best_seller" | null;
  /** Benefits confirmed so far. The rest is confirmed by the team, as on the shop's site. */
  benefits: string[];
  sortOrder: number;
}

export type ProductCategory = "hair" | "beard" | "skin" | "accessory";

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  description: string;
  priceCents: number;
  costCents: number;
  stock: number;
  minStock: number;
  active: boolean;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  /** Usual days between visits, learned from history. */
  cycleDays: number;
  preferredBarberId: string | null;
  createdAt: string;
}

export type SubscriptionStatus = "active" | "paused" | "past_due" | "canceled";
export type SalesChannel = "app" | "counter" | "whatsapp";

export interface Subscription {
  id: string;
  customerId: string;
  /** Who pays. Differs from customerId for dependents (a father paying for his son). */
  payerCustomerId: string;
  planId: string;
  status: SubscriptionStatus;
  startedAt: string;
  canceledAt: string | null;
  /** Day of the month the charge happens. */
  billingDay: number;
  /** Barber who sold or recommended the plan. */
  soldByBarberId: string | null;
  channel: SalesChannel;
}

export type AppointmentStatus = "scheduled" | "completed" | "no_show" | "canceled";

export interface Appointment {
  id: string;
  customerId: string;
  barberId: string;
  unitId: string;
  serviceIds: string[];
  startsAt: string; // ISO, UTC
  durationMin: number;
  status: AppointmentStatus;
  /** Amount charged at the shop (services not covered by the club). */
  chargedCents: number;
  /** Value of the services the club covered, at list price. */
  coveredCents: number;
  subscriptionId: string | null;
  /** Shared by appointments booked together (father and son side by side). */
  groupId: string | null;
  channel: SalesChannel;
}

export interface ProductSale {
  id: string;
  productId: string;
  barberId: string | null;
  customerId: string | null;
  unitId: string;
  quantity: number;
  unitPriceCents: number;
  soldAt: string;
}

export interface ProductReservation {
  id: string;
  productId: string;
  customerId: string;
  quantity: number;
  status: "reserved" | "picked_up" | "canceled";
  createdAt: string;
}

export interface PlanLead {
  id: string;
  customerId: string;
  planId: string;
  createdAt: string;
}

/** Everything the screens read, loaded once per request. */
export interface Snapshot {
  shop: Shop;
  units: Unit[];
  barbers: Barber[];
  services: Service[];
  plans: Plan[];
  products: Product[];
  customers: Customer[];
  subscriptions: Subscription[];
  appointments: Appointment[];
  productSales: ProductSale[];
  reservations: ProductReservation[];
  leads: PlanLead[];
  now: string;
}
