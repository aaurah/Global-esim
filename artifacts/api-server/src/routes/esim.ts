import { createHash, randomBytes, randomUUID } from "node:crypto";
import { and, desc, eq, ilike, sql } from "drizzle-orm";
import { Router, type IRouter } from "express";
import rateLimit from "express-rate-limit";
import {
  CreateOrderBody,
  CreatePlanBody,
  ListPlansQueryParams,
  LookupOrderQueryParams,
  UpdatePlanBody,
} from "@workspace/api-zod";
import { db, esimOrdersTable, esimPlansTable } from "@workspace/db";
import {
  requireAdmin,
  requireSameOrigin,
} from "../middlewares/authorization";

const router: IRouter = Router();
const hashKey = (key: string) =>
  createHash("sha256").update(key, "utf8").digest("hex");
const orderCreationLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
});

function planView(row: typeof esimPlansTable.$inferSelect) {
  return {
    id: row.id,
    name: row.name,
    countryCode: row.countryCode,
    countryName: row.countryName,
    regionType: row.regionType,
    dataMb: row.dataMb,
    validityDays: row.validityDays,
    priceCents: row.priceCents,
    currency: row.currency,
    serviceType: row.serviceType,
    network: row.network,
    status: row.status,
    mode: row.mode,
  };
}

function orderView(
  row: typeof esimOrdersTable.$inferSelect,
  planName: string,
) {
  return {
    id: row.id,
    planId: row.planId,
    planName,
    status: row.status,
    paymentStatus: row.paymentStatus,
    provisioningStatus: row.provisioningStatus,
    amountCents: row.amountCents,
    currency: row.currency,
    mode: row.mode,
    createdAt: row.createdAt.toISOString(),
  };
}

router.get("/plans", async (req, res) => {
  const query = ListPlansQueryParams.parse(req.query);
  const where = query.country
    ? and(
        eq(esimPlansTable.status, "active"),
        eq(esimPlansTable.mode, "sandbox"),
        ilike(esimPlansTable.countryName, `%${query.country}%`),
      )
    : and(
        eq(esimPlansTable.status, "active"),
        eq(esimPlansTable.mode, "sandbox"),
      );
  const rows = await db.select().from(esimPlansTable).where(where);
  res.json(rows.map(planView));
});

router.get("/coverage", async (_req, res) => {
  const rows = await db
    .select({
      countryCode: esimPlansTable.countryCode,
      countryName: esimPlansTable.countryName,
      region: esimPlansTable.regionType,
      planCount: sql<number>`count(*)::int`,
    })
    .from(esimPlansTable)
    .where(
      and(
        eq(esimPlansTable.status, "active"),
        eq(esimPlansTable.mode, "sandbox"),
      ),
    )
    .groupBy(
      esimPlansTable.countryCode,
      esimPlansTable.countryName,
      esimPlansTable.regionType,
    );
  res.json(
    rows.map((row) => ({
      countryCode: row.countryCode ?? "",
      countryName: row.countryName,
      region: row.region,
      planCount: row.planCount,
    })),
  );
});

router.post("/orders", orderCreationLimit, requireSameOrigin, async (req, res) => {
  const input = CreateOrderBody.parse(req.body);
  const [plan] = await db
    .select()
    .from(esimPlansTable)
    .where(
      and(
        eq(esimPlansTable.id, input.planId),
        eq(esimPlansTable.status, "active"),
        eq(esimPlansTable.mode, "sandbox"),
      ),
    )
    .limit(1);
  if (!plan) {
    res.status(400).json({ error: "This sandbox plan is not available" });
    return;
  }
  const id = randomUUID();
  const accessKey = randomBytes(32).toString("base64url");
  const [created] = await db
    .insert(esimOrdersTable)
    .values({
      id,
      accessKeyHash: hashKey(accessKey),
      planId: plan.id,
      email: input.email ?? null,
      status: "sandbox_only",
      paymentStatus: "sandbox_only",
      provisioningStatus: "not_requested",
      amountCents: plan.priceCents,
      currency: plan.currency,
      mode: "sandbox",
    })
    .returning();
  if (!created) {
    res.status(500).json({ error: "Could not create sandbox order" });
    return;
  }
  res.status(201).json({
    order: orderView(created, plan.name),
    accessKey,
    mode: "sandbox",
  });
});

router.get("/orders/lookup", async (req, res) => {
  const query = LookupOrderQueryParams.parse(req.query);
  const accessKey = query.accessKey;
  if (accessKey.length < 32 || accessKey.length > 128) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  const [row] = await db
    .select({ order: esimOrdersTable, planName: esimPlansTable.name })
    .from(esimOrdersTable)
    .innerJoin(esimPlansTable, eq(esimOrdersTable.planId, esimPlansTable.id))
    .where(eq(esimOrdersTable.accessKeyHash, hashKey(accessKey)))
    .limit(1);
  if (!row) {
    res.status(404).json({ error: "Order not found" });
    return;
  }
  res.json(orderView(row.order, row.planName));
});

router.get("/dashboard/summary", requireAdmin, async (_req, res) => {
  const [orderCount, planCount, totalValue, recent] = await Promise.all([
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(esimOrdersTable)
      .where(eq(esimOrdersTable.mode, "sandbox")),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(esimPlansTable)
      .where(
        and(
          eq(esimPlansTable.mode, "sandbox"),
          eq(esimPlansTable.status, "active"),
        ),
      ),
    db
      .select({ sum: sql<number>`coalesce(sum(${esimOrdersTable.amountCents}), 0)::int` })
      .from(esimOrdersTable)
      .where(eq(esimOrdersTable.mode, "sandbox")),
    db
      .select({ order: esimOrdersTable, planName: esimPlansTable.name })
      .from(esimOrdersTable)
      .innerJoin(esimPlansTable, eq(esimOrdersTable.planId, esimPlansTable.id))
      .orderBy(desc(esimOrdersTable.createdAt))
      .limit(6),
  ]);
  res.json({
    mode: "sandbox",
    orderCount: orderCount[0]?.count ?? 0,
    activePlans: planCount[0]?.count ?? 0,
    sandboxOrderValueCents: totalValue[0]?.sum ?? 0,
    integrationCount: 0,
    recentOrders: recent.map((row) => orderView(row.order, row.planName)),
  });
});

router.get("/admin/plans", requireAdmin, async (_req, res) => {
  const rows = await db
    .select()
    .from(esimPlansTable)
    .where(eq(esimPlansTable.mode, "sandbox"));
  res.json(rows.map(planView));
});

router.post("/admin/plans", requireAdmin, requireSameOrigin, async (req, res) => {
  const input = CreatePlanBody.parse(req.body);
  const [row] = await db
    .insert(esimPlansTable)
    .values({ ...input, currency: "USD", status: "active", mode: "sandbox" })
    .returning();
  res.status(201).json(planView(row));
});

router.patch(
  "/admin/plans/:id",
  requireAdmin,
  requireSameOrigin,
  async (req, res) => {
  const id = Number(req.params.id);
  const input = UpdatePlanBody.parse(req.body);
  if (!Number.isSafeInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid plan ID" });
    return;
  }
  const [row] = await db
    .update(esimPlansTable)
    .set(input)
    .where(
      and(
        eq(esimPlansTable.id, id),
        eq(esimPlansTable.mode, "sandbox"),
      ),
    )
    .returning();
  if (!row) {
    res.status(404).json({ error: "Plan not found" });
    return;
  }
  res.json(planView(row));
  },
);

router.delete(
  "/admin/plans/:id",
  requireAdmin,
  requireSameOrigin,
  async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id <= 0) {
    res.status(400).json({ error: "Invalid plan ID" });
    return;
  }
  try {
    const deleted = await db
      .delete(esimPlansTable)
      .where(
        and(
          eq(esimPlansTable.id, id),
          eq(esimPlansTable.mode, "sandbox"),
        ),
      )
      .returning({ id: esimPlansTable.id });
    if (deleted.length === 0) {
      res.status(404).json({ error: "Plan not found" });
      return;
    }
    res.status(204).end();
  } catch {
    res.status(409).json({
      error: "This plan has orders and cannot be deleted; hide it instead.",
    });
  }
  },
);

router.get("/admin/orders", requireAdmin, async (_req, res) => {
  const rows = await db
    .select({ order: esimOrdersTable, planName: esimPlansTable.name })
    .from(esimOrdersTable)
    .innerJoin(esimPlansTable, eq(esimOrdersTable.planId, esimPlansTable.id))
    .orderBy(desc(esimOrdersTable.createdAt))
    .limit(100);
  res.json(rows.map((row) => orderView(row.order, row.planName)));
});

router.get("/integrations/status", (_req, res) => {
  const hasBtcpay =
    Boolean(process.env.BTCPAY_SERVER_URL) && Boolean(process.env.BTCPAY_API_KEY);
  const hasSupplier =
    Boolean(process.env.ESIM_SUPPLIER_URL) &&
    Boolean(process.env.ESIM_SUPPLIER_API_KEY);
  res.json([
    {
      id: "btcpay",
      name: "BTCPay Server",
      category: "crypto_payments",
      status: hasBtcpay ? "awaiting_provider" : "not_configured",
      mode: "sandbox",
      detail: hasBtcpay
        ? "Credentials are present. Provider health and invoice settlement still need verification."
        : "Not connected. No crypto payments are accepted or shown as settled.",
    },
    {
      id: "esim_supplier",
      name: "Telecom supplier",
      category: "provisioning",
      status: hasSupplier ? "awaiting_provider" : "not_configured",
      mode: "sandbox",
      detail: hasSupplier
        ? "Credentials are present. Coverage, provisioning, and webhook verification are still required."
        : "No supplier is connected. No live coverage, eSIM profile, or phone number is available.",
    },
    {
      id: "voice_sms",
      name: "Voice & SMS",
      category: "telecom",
      status: "awaiting_provider",
      mode: "sandbox",
      detail: "Available only when an authorized supplier supports the requested destination and service.",
    },
  ]);
});

export default router;
