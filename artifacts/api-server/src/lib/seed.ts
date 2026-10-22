import { db, esimPlansTable } from "@workspace/db";

const sandboxPlans = [
  {
    name: "Japan · 3 GB",
    countryCode: "JP",
    countryName: "Japan",
    regionType: "country",
    dataMb: 3072,
    validityDays: 7,
    priceCents: 900,
    currency: "USD",
    serviceType: "data",
    network: "Sandbox carrier data — not live coverage",
    status: "active",
    mode: "sandbox",
  },
  {
    name: "Australia · 5 GB",
    countryCode: "AU",
    countryName: "Australia",
    regionType: "country",
    dataMb: 5120,
    validityDays: 15,
    priceCents: 1400,
    currency: "USD",
    serviceType: "data",
    network: "Sandbox carrier data — not live coverage",
    status: "active",
    mode: "sandbox",
  },
  {
    name: "Europe · 10 GB",
    countryCode: null,
    countryName: "Europe",
    regionType: "regional",
    dataMb: 10240,
    validityDays: 30,
    priceCents: 2400,
    currency: "USD",
    serviceType: "data",
    network: "Sandbox carrier data — not live coverage",
    status: "active",
    mode: "sandbox",
  },
  {
    name: "Global · 5 GB",
    countryCode: null,
    countryName: "Global",
    regionType: "global",
    dataMb: 5120,
    validityDays: 30,
    priceCents: 3200,
    currency: "USD",
    serviceType: "data",
    network: "Sandbox carrier data — not live coverage",
    status: "active",
    mode: "sandbox",
  },
];

export async function seedSandboxCatalog() {
  const existing = await db.select({ id: esimPlansTable.id }).from(esimPlansTable).limit(1);
  if (existing.length === 0) {
    await db.insert(esimPlansTable).values(sandboxPlans);
  }
}
