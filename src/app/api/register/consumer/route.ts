import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { organizations } from "@/db/schema";
import { generateApiKey, hashApiKey } from "@/lib/crypto";
import { stripe } from "@/lib/stripe";
import { ok, validationError, err } from "@/lib/response";

const schema = z.object({
  name: z.string().min(1).max(200),
  email: z.string().email(),
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

  const { name, email } = parsed.data;

  // Create Stripe customer
  let stripeCustomer: { id: string };
  try {
    stripeCustomer = await stripe.customers.create({ name, email });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "stripe error";
    return err("stripe_error", 502, { reason: msg });
  }

  const apiKey = generateApiKey();
  const apiKeyHash = hashApiKey(apiKey);

  try {
    const [org] = await db
      .insert(organizations)
      .values({
        name,
        email,
        apiKeyHash,
        stripeCustomerId: stripeCustomer.id,
      })
      .returning({
        id: organizations.id,
        stripeCustomerId: organizations.stripeCustomerId,
      });

    return ok({ org_id: org.id, api_key: apiKey, stripe_customer_id: org.stripeCustomerId }, 201);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    if (msg.includes("unique") || msg.includes("duplicate")) {
      return err("email_already_registered", 409);
    }
    throw e;
  }
}
