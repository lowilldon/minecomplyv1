import { eq } from "drizzle-orm";
import { db } from "@/db";
import { organizations, providers } from "@/db/schema";
import { hashApiKey } from "./crypto";
import type { NextRequest } from "next/server";

export async function getOrgFromRequest(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;

  const rawKey = auth.slice(7).trim();
  const hash = hashApiKey(rawKey);

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.apiKeyHash, hash))
    .limit(1);

  return org ?? null;
}

export async function getProviderFromRequest(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;

  const rawKey = auth.slice(7).trim();
  const hash = hashApiKey(rawKey);

  const [provider] = await db
    .select()
    .from(providers)
    .where(eq(providers.providerApiKeyHash, hash))
    .limit(1);

  return provider ?? null;
}
