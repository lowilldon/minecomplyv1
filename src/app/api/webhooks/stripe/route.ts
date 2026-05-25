import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { stripe } from "@/lib/stripe";
import { db } from "@/db";
import { transactions } from "@/db/schema";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature");

  if (!sig) {
    return NextResponse.json({ error: "missing signature" }, { status: 400 });
  }

  let event: ReturnType<typeof stripe.webhooks.constructEvent> extends Promise<infer T> ? T : ReturnType<typeof stripe.webhooks.constructEvent>;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "webhook error";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  if (event.type === "payment_intent.payment_failed") {
    const pi = event.data.object as { id: string };
    await db
      .update(transactions)
      .set({ status: "failed" })
      .where(eq(transactions.stripeChargeId, pi.id));
  }

  return NextResponse.json({ received: true });
}
