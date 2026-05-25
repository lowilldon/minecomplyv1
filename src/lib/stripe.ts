import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-02-24.acacia",
});

/** Convert USD to Stripe's smallest unit (cents). Minimum 1 cent. */
export function usdToCents(usd: number): number {
  return Math.max(1, Math.round(usd * 100));
}
