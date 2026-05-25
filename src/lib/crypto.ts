import { createHash, randomBytes } from "crypto";

const SALT = process.env.API_KEY_SALT ?? "default-insecure-salt";

export function hashApiKey(key: string): string {
  return createHash("sha256").update(SALT + key).digest("hex");
}

export function generateApiKey(): string {
  return randomBytes(32).toString("hex");
}
