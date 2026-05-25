import { NextRequest } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db } from "@/db";
import { providers, paymentProofs, transactions } from "@/db/schema";
import { stripe, usdToCents } from "@/lib/stripe";
import { signProof } from "@/lib/jwt";
import { getOrgFromRequest } from "@/lib/auth";
import { checkRateLimit } from "@/lib/ratelimit";
import { ok, unauthorized, validationError, err } from "@/lib/response";

const schema = z.object({
  provider_id: z.string().uuid(),
  agent_id: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const org = await getOrgFromRequest(req);
  if (!org) return unauthorized();

  // Rate limit per org
  const { success: rateLimitOk } = await checkRateLimit(org.id);
  if (!rateLimitOk) {
    return err("rate_limit_exceeded", 429, { reason: "100 requests per minute exceeded" });
  }

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

  const { provider_id } = parsed.data;

  // Look up provider
  const [provider] = await db
    .select()
    .from(providers)
    .where(eq(providers.id, provider_id))
    .limit(1);

  if (!provider) return err("provider_not_found", 404);
  if (!provider.active) return err("provider_inactive", 400);

  // Validate org has a payment method
  if (!org.stripeCustomerId || !org.stripePaymentMethodId) {
    return err("payment_method_required", 400, {
      reason: "Attach a Stripe payment method before calling /facilitate",
    });
  }

  const priceUsd = parseFloat(provider.priceUsd);
  const amountCents = usdToCents(priceUsd);
  const jti = nanoid();

  // Create transaction record (pending)
  const [txn] = await db
    .insert(transactions)
    .values({
      orgId: org.id,
      providerId: provider.id,
      amountUsd: provider.priceUsd,
      status: "pending",
    })
    .returning({ id: transactions.id });

  // Charge via Stripe
  let paymentIntent: { id: string; status: string };
  try {
    paymentIntent = await stripe.paymentIntents.create({
      amount: amountCents,
      currency: "usd",
      customer: org.stripeCustomerId,
      payment_method: org.stripePaymentMethodId,
      confirm: true,
      off_session: true,
      metadata: {
        org_id: org.id,
        provider_id: provider.id,
        proof_jti: jti,
      },
    });
  } catch (e: unknown) {
    // Mark transaction failed
    await db
      .update(transactions)
      .set({ status: "failed" })
      .where(eq(transactions.id, txn.id));

    const stripeErr = e as { message?: string; code?: string };
    return err("payment_failed", 402, {
      reason: stripeErr.message ?? "Stripe charge failed",
      stripe_code: stripeErr.code,
    });
  }

  if (paymentIntent.status !== "succeeded") {
    await db
      .update(transactions)
      .set({ status: "failed", stripeChargeId: paymentIntent.id })
      .where(eq(transactions.id, txn.id));

    return err("payment_failed", 402, {
      reason: `Payment intent status: ${paymentIntent.status}`,
    });
  }

  // Sign JWT proof
  const { token, expiresAt } = await signProof({
    sub: org.id,
    provider_id: provider.id,
    amount_usd: provider.priceUsd,
    stripe_charge_id: paymentIntent.id,
    jti,
  });

  // Persist proof
  const [proof] = await db
    .insert(paymentProofs)
    .values({
      token,
      jti,
      orgId: org.id,
      providerId: provider.id,
      amountUsd: provider.priceUsd,
      stripeChargeId: paymentIntent.id,
      expiresAt,
    })
    .returning({ id: paymentProofs.id });

  // Update transaction to succeeded
  await db
    .update(transactions)
    .set({
      status: "succeeded",
      stripeChargeId: paymentIntent.id,
      proofId: proof.id,
    })
    .where(eq(transactions.id, txn.id));

  return ok({
    proof: token,
    expires_at: expiresAt.toISOString(),
    amount_charged: priceUsd,
  });
}
