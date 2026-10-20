import "server-only";
import { DEMO_CUSTOMER_ID } from "./data/demo-dataset";

/**
 * The customer app has no login in the MVP: everyone sees the demo customer (Rafael, who
 * pays the club for himself and his son). Replace with the real session when login lands.
 */
export async function currentCustomerId(): Promise<string> {
  return DEMO_CUSTOMER_ID;
}
