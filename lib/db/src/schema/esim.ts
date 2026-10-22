import {
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";

export const esimPlansTable = pgTable("esim_plans", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  countryCode: varchar("country_code", { length: 8 }),
  countryName: varchar("country_name", { length: 100 }).notNull(),
  regionType: varchar("region_type", { length: 20 }).notNull(),
  dataMb: integer("data_mb").notNull(),
  validityDays: integer("validity_days").notNull(),
  priceCents: integer("price_cents").notNull(),
  currency: varchar("currency", { length: 3 }).notNull().default("USD"),
  serviceType: varchar("service_type", { length: 30 }).notNull(),
  network: varchar("network", { length: 120 }).notNull(),
  status: varchar("status", { length: 16 }).notNull().default("active"),
  mode: varchar("mode", { length: 16 }).notNull().default("sandbox"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const esimOrdersTable = pgTable("esim_orders", {
  id: varchar("id", { length: 36 }).primaryKey(),
  accessKeyHash: varchar("access_key_hash", { length: 64 }).notNull().unique(),
  planId: integer("plan_id")
    .notNull()
    .references(() => esimPlansTable.id, { onDelete: "restrict" }),
  email: varchar("email", { length: 320 }),
  status: varchar("status", { length: 32 }).notNull(),
  paymentStatus: varchar("payment_status", { length: 32 }).notNull(),
  provisioningStatus: varchar("provisioning_status", { length: 32 }).notNull(),
  amountCents: integer("amount_cents").notNull(),
  currency: varchar("currency", { length: 3 }).notNull(),
  mode: varchar("mode", { length: 16 }).notNull().default("sandbox"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type EsimPlan = typeof esimPlansTable.$inferSelect;
export type EsimOrder = typeof esimOrdersTable.$inferSelect;

export const providerSettingsTable = pgTable("provider_settings", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  category: varchar("category", { length: 40 }).notNull(),
  environment: varchar("environment", { length: 16 }).notNull().default("sandbox"),
  endpoint: text("endpoint"),
  enabled: integer("enabled").notNull().default(0),
  status: varchar("status", { length: 32 }).notNull().default("not_configured"),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});
