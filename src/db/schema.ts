import {
  pgTable,
  text,
  timestamp,
  numeric,
  boolean,
  uuid,
} from "drizzle-orm/pg-core";

export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  apiKeyHash: text("api_key_hash").notNull().unique(),
  stripeCustomerId: text("stripe_customer_id"),
  stripePaymentMethodId: text("stripe_payment_method_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const providers = pgTable("providers", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  endpointUrl: text("endpoint_url").notNull(),
  priceUsd: numeric("price_usd", { precision: 12, scale: 6 }).notNull(),
  ownerOrgId: uuid("owner_org_id")
    .notNull()
    .references(() => organizations.id),
  providerApiKeyHash: text("provider_api_key_hash").notNull().unique(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const paymentProofs = pgTable("payment_proofs", {
  id: uuid("id").primaryKey().defaultRandom(),
  token: text("token").notNull(),
  jti: text("jti").notNull().unique(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id),
  providerId: uuid("provider_id")
    .notNull()
    .references(() => providers.id),
  amountUsd: numeric("amount_usd", { precision: 12, scale: 6 }).notNull(),
  stripeChargeId: text("stripe_charge_id").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const transactions = pgTable("transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id),
  providerId: uuid("provider_id")
    .notNull()
    .references(() => providers.id),
  amountUsd: numeric("amount_usd", { precision: 12, scale: 6 }).notNull(),
  stripeChargeId: text("stripe_charge_id"),
  proofId: uuid("proof_id").references(() => paymentProofs.id),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Organization = typeof organizations.$inferSelect;
export type Provider = typeof providers.$inferSelect;
export type PaymentProof = typeof paymentProofs.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
