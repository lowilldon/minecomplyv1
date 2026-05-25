import { NextRequest } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { paymentProofs } from "@/db/schema";
import { verifyProof } from "@/lib/jwt";
import { getProviderFromRequest } from "@/lib/auth";
import { ok, unauthorized, validationError } from "@/lib/response";

const schema = z.object({
  proof: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const provider = await getProviderFromRequest(req);
  if (!provider) return unauthorized();

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

  const { proof } = parsed.data;

  // Verify JWT signature and expiry
  let payload: Awaited<ReturnType<typeof verifyProof>>;
  try {
    payload = await verifyProof(proof);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    const reason = msg.includes("expired") ? "expired" : "invalid_signature";
    return ok({ valid: false, reason }, 200);
  }

  // Check provider_id matches
  if (payload.provider_id !== provider.id) {
    return ok({ valid: false, reason: "provider_mismatch" }, 200);
  }

  // Look up proof record by jti (nonce)
  const [proofRecord] = await db
    .select()
    .from(paymentProofs)
    .where(eq(paymentProofs.jti, payload.jti!))
    .limit(1);

  if (!proofRecord) {
    return ok({ valid: false, reason: "proof_not_found" }, 200);
  }

  // Replay attack prevention
  if (proofRecord.usedAt) {
    return ok({ valid: false, reason: "already_used" }, 200);
  }

  // Double-check expiry against DB record too
  if (new Date() > proofRecord.expiresAt) {
    return ok({ valid: false, reason: "expired" }, 200);
  }

  // Mark as used
  await db
    .update(paymentProofs)
    .set({ usedAt: new Date() })
    .where(eq(paymentProofs.id, proofRecord.id));

  return ok({
    valid: true,
    org_id: payload.sub,
    amount_usd: payload.amount_usd,
    charged_at: proofRecord.createdAt.toISOString(),
  });
}
