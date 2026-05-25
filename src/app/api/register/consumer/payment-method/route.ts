import { NextRequest } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { organizations } from "@/db/schema";
import { stripe } from "@/lib/stripe";
import { ok, validationError, err } from "@/lib/response";

const schema = z.object({
  org_id: z.string().uuid(),
  stripe_payment_method_id: z.string().min(1),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return validationError("invalid JSON body");
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return validationError(parsed.error.issues.map((i) => i.message).join(", "));
  }

  const { org_id, stripe_payment_method_id } = parsed.data;

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, org_id))
    .limit(1);

  if (!org) return err("org_not_found", 404);
  if (!org.stripeCustomerId) return err("stripe_customer_not_set", 400);

  try {
    // Attach PM to customer
    await stripe.paymentMethods.attach(stripe_payment_method_id, {
      customer: org.stripeCustomerId,
    });

    // Set as default
    await stripe.customers.update(org.stripeCustomerId, {
      invoice_settings: { default_payment_method: stripe_payment_method_id },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "stripe error";
    return err("stripe_error", 502, { reason: msg });
  }

  await db
    .update(organizations)
    .set({ stripePaymentMethodId: stripe_payment_method_id })
    .where(eq(organizations.id, org_id));

  return ok({ success: true, org_id, stripe_payment_method_id });
}
