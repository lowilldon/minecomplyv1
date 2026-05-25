# Fiat402

**x402 protocol middleware** — translates HTTP 402 payment challenges into Stripe microbilling so AI agents can pay for gated APIs in USD without crypto wallets.

## How it works

```
Agent hits 402 API → calls POST /api/facilitate with org api_key
Fiat402 charges org's Stripe PM → returns signed JWT proof (60s TTL)
Agent passes proof in Authorization header to upstream API
Upstream calls POST /api/verify with provider_api_key → validates proof
Call goes through. No crypto. No wallets.
```

## Quick start

### 1. Generate RS256 keypair

```bash
# Generate 2048-bit RSA private key
openssl genrsa -out private.pem 2048

# Extract public key
openssl rsa -in private.pem -pubout -out public.pem

# Print as single-line for .env (replace newlines with \n)
awk 'NF {sub(/\r/, ""); printf "%s\\n",$0;}' private.pem
awk 'NF {sub(/\r/, ""); printf "%s\\n",$0;}' public.pem
```

Paste the output into `.env.local`:
```
JWT_PRIVATE_KEY_PEM="-----BEGIN RSA PRIVATE KEY-----\nMIIE...\n-----END RSA PRIVATE KEY-----"
JWT_PUBLIC_KEY_PEM="-----BEGIN PUBLIC KEY-----\nMIIB...\n-----END PUBLIC KEY-----"
```

### 2. Set up environment

```bash
cp .env.example .env.local
# Fill in:
# - STRIPE_SECRET_KEY (from Stripe dashboard, use sk_test_... for testing)
# - DATABASE_URL (Neon Postgres connection string)
# - JWT_PRIVATE_KEY_PEM, JWT_PUBLIC_KEY_PEM (from step 1)
# - API_KEY_SALT (any random secret string)
# - UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN (optional, for rate limiting)
```

### 3. Set up database

```bash
npm install
npm run db:push   # push schema to Neon (dev)
# or
npm run db:migrate  # run migrations (prod)
```

### 4. Run

```bash
npm run dev
# Open http://localhost:3000/test for the interactive test harness
```

## API reference

### POST /api/register/consumer
Register an organization (agent owner). Returns plaintext `api_key` — store it securely, it is never shown again.

```json
// Request
{ "name": "Acme Corp", "email": "team@acme.com" }

// Response 201
{ "org_id": "uuid", "api_key": "hex64", "stripe_customer_id": "cus_..." }
```

### POST /api/register/consumer/payment-method
Attach a Stripe payment method to an org.

```json
// Request
{ "org_id": "uuid", "stripe_payment_method_id": "pm_..." }
```

### POST /api/register/provider
Register a 402-gated API. Requires `Authorization: Bearer <org_api_key>`.

```json
// Request
{ "name": "Weather API", "endpoint_url": "https://api.example.com", "price_usd": 0.005 }

// Response 201
{ "provider_id": "uuid", "provider_api_key": "hex64" }
```

### POST /api/facilitate
Core endpoint. Called by the agent instead of paying in crypto.
Requires `Authorization: Bearer <org_api_key>`.

Rate limited: 100 req/min per org.

```json
// Request
{ "provider_id": "uuid" }

// Response 200
{
  "proof": "<JWT>",
  "expires_at": "2024-01-01T00:01:00Z",
  "amount_charged": 0.005
}

// On payment failure → 402
{ "error": "payment_failed", "reason": "...", "stripe_code": "..." }
```

### POST /api/verify
Called by the upstream 402-gated API to validate a proof.
Requires `Authorization: Bearer <provider_api_key>`.

```json
// Request
{ "proof": "<JWT>" }

// Response (success)
{ "valid": true, "org_id": "uuid", "amount_usd": "0.005000", "charged_at": "..." }

// Response (failure)
{ "valid": false, "reason": "expired" | "already_used" | "provider_mismatch" | "invalid_signature" }
```

### GET /api/dashboard/transactions
Returns last 100 transactions for the authenticated org.
Requires `Authorization: Bearer <org_api_key>`.

### GET /.well-known/fiat402-jwks
Returns the public JWKS so any party can verify proof JWTs independently.

### POST /api/webhooks/stripe
Stripe webhook handler. Configure in Stripe dashboard to send `payment_intent.payment_failed`.

## Security design

- **API keys** are stored as SHA-256(salt + key) — only the hash is in the DB
- **Payment proofs** are RS256 JWTs with a 60-second TTL
- **Replay attacks** prevented by single-use enforcement (`used_at` check)
- **Provider isolation**: `/verify` validates the proof's `provider_id` matches the authenticating provider key
- **Rate limiting**: 100 req/min per org on `/api/facilitate` via Upstash Redis (no-op fallback for local dev)

## Database schema

```
organizations    → id, name, email, api_key_hash, stripe_customer_id, stripe_payment_method_id
providers        → id, name, endpoint_url, price_usd, owner_org_id, provider_api_key_hash, active
payment_proofs   → id, token, jti, org_id, provider_id, amount_usd, stripe_charge_id, expires_at, used_at
transactions     → id, org_id, provider_id, amount_usd, stripe_charge_id, proof_id, status
```

## Stripe test mode

Use these Stripe test payment method IDs:
- `pm_card_visa` — Visa that always succeeds
- `pm_card_mastercard` — Mastercard that always succeeds
- `pm_card_chargeDeclined` — Card that always fails (tests 402 response)

Set up the webhook:
```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```
