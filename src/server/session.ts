import "server-only";
import { redirect } from "next/navigation";
import { DEMO_CUSTOMER_ID } from "./data/demo-dataset";
import { customerLoginEnabled, sessionCustomerId } from "./customer-auth";

/**
 * Who is using the customer app. With CUSTOMER_LOGIN off (the demo), everyone is the demo
 * customer (Rafael, who pays the club for himself and his son). With it on, the signed-in
 * customer; without a session, the person is sent to sign in.
 */
export async function currentCustomerId(): Promise<string> {
  if (!customerLoginEnabled()) return DEMO_CUSTOMER_ID;
  const id = await sessionCustomerId();
  if (!id) redirect("/entrar");
  return id;
}
