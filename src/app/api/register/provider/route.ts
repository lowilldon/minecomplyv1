import { NextRequest } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { providers } from "@/db/schema";
import { generateApiKey, hashApiKey } from "@/lib/crypto";
import { getOrgFromRequest } from "@/lib/auth";
import { ok, unauthorized, validationError } from "@/lib/response";

const schema = z.object({
  name: z.string().min(1).max(200),
  endpoint_url: z.string().url(),
  price_usd: z.number().positive().min(0.001),
});

export async function POST(req: NextRequest) {
  const org = await getOrgFromRequest(req);
  if (!org) return unauthorized();

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

  const { name, endpoint_url, price_usd } = parsed.data;

  const providerApiKey = generateApiKey();
  const providerApiKeyHash = hashApiKey(providerApiKey);

  const [provider] = await db
    .insert(providers)
    .values({
      name,
      endpointUrl: endpoint_url,
      priceUsd: price_usd.toString(),
      ownerOrgId: org.id,
      providerApiKeyHash,
    })
    .returning({ id: providers.id });

  return ok(
    { provider_id: provider.id, provider_api_key: providerApiKey },
    201
  );
}
