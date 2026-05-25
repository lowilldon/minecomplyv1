import { SignJWT, importPKCS8, importSPKI, jwtVerify, exportJWK, type JWTPayload } from "jose";

function pemToCryptoKey(pem: string): string {
  // Replace literal \n sequences with actual newlines (for env var storage)
  return pem.replace(/\\n/g, "\n");
}

export async function getPrivateKey() {
  const pem = pemToCryptoKey(process.env.JWT_PRIVATE_KEY_PEM!);
  return importPKCS8(pem, "RS256");
}

export async function getPublicKey() {
  const pem = pemToCryptoKey(process.env.JWT_PUBLIC_KEY_PEM!);
  return importSPKI(pem, "RS256");
}

export interface ProofPayload extends JWTPayload {
  sub: string;         // org_id
  provider_id: string;
  amount_usd: string;
  stripe_charge_id: string;
  jti: string;         // nonce
}

export async function signProof(payload: Omit<ProofPayload, "iat" | "exp">): Promise<{ token: string; expiresAt: Date }> {
  const privateKey = await getPrivateKey();
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 60; // 60 second window

  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .sign(privateKey);

  return { token, expiresAt: new Date(exp * 1000) };
}

export async function verifyProof(token: string): Promise<ProofPayload> {
  const publicKey = await getPublicKey();
  const { payload } = await jwtVerify(token, publicKey, { algorithms: ["RS256"] });
  return payload as ProofPayload;
}

export async function getJwks() {
  const publicKey = await getPublicKey();
  const jwk = await exportJWK(publicKey);
  jwk.use = "sig";
  jwk.alg = "RS256";
  return { keys: [jwk] };
}
