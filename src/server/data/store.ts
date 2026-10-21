import "server-only";
import { cache } from "react";
import type { Appointment, Customer, PlanLead, ProductReservation, Snapshot } from "@/domain/types";
import { createDemoStore } from "./demo-store";
import { createSupabaseStore, supabaseConfigured } from "./supabase-store";

export type NewAppointment = Omit<Appointment, "id" | "status">;
export type NewReservation = Omit<ProductReservation, "id" | "status" | "createdAt">;
export type NewPlanLead = Omit<PlanLead, "id" | "createdAt">;
export type NewCustomer = Omit<Customer, "id" | "createdAt" | "referralCode" | "cycleDays" | "preferredBarberId">;

export interface Store {
  /** "demo" runs on generated data in memory; "supabase" reads and writes the project's tables. */
  mode: "demo" | "supabase";
  snapshot(now: Date): Promise<Snapshot>;
  createAppointments(items: NewAppointment[]): Promise<Appointment[]>;
  createReservation(item: NewReservation): Promise<ProductReservation>;
  createPlanLead(item: NewPlanLead): Promise<PlanLead>;
  /** A person managed by an account holder (son, father-in-law…). */
  createCustomer(item: NewCustomer): Promise<Customer>;
  /** Supabase only: rebuild the demo history dated from today. */
  reseedDemo?(): Promise<void>;
}

let store: Store | null = null;

export function getStore(): Store {
  store ??= supabaseConfigured() ? createSupabaseStore() : createDemoStore();
  return store;
}

/** One snapshot per request, shared by every component that asks for it. */
export const loadSnapshot = cache(async (): Promise<Snapshot> => getStore().snapshot(new Date()));
