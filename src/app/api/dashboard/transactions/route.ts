import { NextRequest } from "next/server";
import { eq, desc } from "drizzle-orm";
import { db } from "@/db";
import { transactions, providers } from "@/db/schema";
import { getOrgFromRequest } from "@/lib/auth";
import { ok, unauthorized } from "@/lib/response";

export async function GET(req: NextRequest) {
  const org = await getOrgFromRequest(req);
  if (!org) return unauthorized();

  const rows = await db
    .select({
      id: transactions.id,
      amount_usd: transactions.amountUsd,
      stripe_charge_id: transactions.stripeChargeId,
      status: transactions.status,
      created_at: transactions.createdAt,
      provider_id: transactions.providerId,
      provider_name: providers.name,
      provider_endpoint: providers.endpointUrl,
    })
    .from(transactions)
    .leftJoin(providers, eq(transactions.providerId, providers.id))
    .where(eq(transactions.orgId, org.id))
    .orderBy(desc(transactions.createdAt))
    .limit(100);

  return ok({ transactions: rows });
}
