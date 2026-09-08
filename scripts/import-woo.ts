/**
 * Import the catalogue from the old WooCommerce site.
 *
 *   npm run import:woo -- --dry-run     # fetch, classify, report, write nothing
 *   npm run import:woo                  # apply
 *   npm run import:woo -- --limit 50    # first 50 products only
 *
 * Safe to re-run: products, services and categories are matched on `wooId`, so
 * a second pass updates rather than duplicating.
 *
 * A CSV report is written to ./import-reports/ every run, including dry runs.
 */
import "dotenv/config";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { Prisma } from "../src/generated/prisma/client";
import type { VehicleClass } from "../src/generated/prisma/enums";
import { db } from "../src/lib/db";
import { slugify } from "../src/lib/utils";
import {
  classify,
  detectCondition,
  isTemplateDemoProduct,
  looksLikeInvoiceLine,
  readsLikeLabour,
  REVIEW_THRESHOLD,
  type Classification,
} from "../src/lib/woo/classify";
import {
  decodeAmount,
  decodeEntities,
  htmlToText,
  StoreApi,
  type WooProduct,
} from "../src/lib/woo/store-api";

const DRY_RUN = process.argv.includes("--dry-run");
const LIMIT = (() => {
  const i = process.argv.indexOf("--limit");
  return i === -1 ? null : Number.parseInt(process.argv[i + 1] ?? "", 10) || null;
})();

/**
 * Images on the old site are two files from the WordPress theme's demo content,
 * reused as placeholders. Re-hosting them would mean shipping stock photos of
 * someone else's products, so they are skipped and the product is flagged as
 * needing a real photo.
 */
const PLACEHOLDER_IMAGE = /\/product-\d+\.jpe?g$/i;

type Row = {
  wooId: number;
  name: string;
  outcome: string;
  kind: string;
  category: string;
  price: string;
  confidence: number | "";
  flags: string;
};

const rows: Row[] = [];
const stats = {
  fetched: 0,
  productsCreated: 0,
  productsUpdated: 0,
  servicesCreated: 0,
  servicePricesWritten: 0,
  skipped: 0,
  flagged: 0,
  redirects: 0,
  imagesImported: 0,
  placeholdersSkipped: 0,
  templateDemoSkipped: 0,
  retired: 0,
};

/** Cache of category slug -> id, so we resolve the tree once. */
const categoryIds = new Map<string, string>();
const serviceCategoryIds = new Map<string, string>();
/** Base service name -> service id, so the Car/Van/SUV triplets converge. */
const serviceIds = new Map<string, string>();
const usedSkus = new Set<string>();
const usedSlugs = new Set<string>();
/** wooIds imported as products this run, for the reconciliation pass. */
const seenAsProduct = new Set<number>();

async function loadTaxonomy() {
  const categories = await db.category.findMany({
    select: { id: true, slug: true },
  });
  for (const c of categories) categoryIds.set(c.slug, c.id);

  const serviceCategories = await db.serviceCategory.findMany({
    select: { id: true, slug: true },
  });
  for (const c of serviceCategories) serviceCategoryIds.set(c.slug, c.id);

  const products = await db.product.findMany({ select: { sku: true, slug: true } });
  for (const p of products) {
    usedSkus.add(p.sku);
    usedSlugs.add(p.slug);
  }
  const services = await db.service.findMany({ select: { slug: true } });
  for (const s of services) usedSlugs.add(`svc:${s.slug}`);
}

/**
 * Resolve a classifier target to a category id.
 *
 * The seed builds child slugs as slugify(`${parent} ${child}`), so the same
 * rule is applied here rather than storing ids in the rules table.
 */
function resolveCategoryId(target: { parent: string; child: string | null }): string | null {
  if (target.child) {
    const childId = categoryIds.get(slugify(`${target.parent} ${target.child}`));
    if (childId) return childId;
  }
  return categoryIds.get(slugify(target.parent)) ?? null;
}

/**
 * Generate a SKU. Not one of the 955 source products has one, so every SKU on
 * the new site is minted here — stable per source product, and readable enough
 * for counter staff to quote over the phone.
 */
function makeSku(name: string, wooId: number): string {
  const letters =
    name
      .toUpperCase()
      .replace(/[^A-Z0-9 ]/g, " ")
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w.slice(0, 3))
      .join("")
      .slice(0, 6) || "PART";
  let sku = `CD-${letters}-${wooId}`;
  let n = 2;
  while (usedSkus.has(sku)) sku = `CD-${letters}-${wooId}-${n++}`;
  usedSkus.add(sku);
  return sku;
}

function uniqueSlug(base: string, namespace = ""): string {
  const root = slugify(base) || "item";
  let slug = root;
  let n = 2;
  while (usedSlugs.has(`${namespace}${slug}`)) slug = `${root}-${n++}`;
  usedSlugs.add(`${namespace}${slug}`);
  return slug;
}

function record(row: Row) {
  rows.push(row);
  if (row.flags) stats.flagged++;
}

async function importProduct(woo: WooProduct, cls: Classification) {
  const name = decodeEntities(woo.name);
  const priceStr = decodeAmount(woo.prices.regular_price, woo.prices.currency_minor_unit);
  const saleStr = decodeAmount(woo.prices.sale_price, woo.prices.currency_minor_unit);
  const price = Number.parseFloat(priceStr);
  const sale = Number.parseFloat(saleStr);

  if (cls.kind !== "part") throw new Error("importProduct called with a service");

  seenAsProduct.add(woo.id);

  const categoryId = cls.category ? resolveCategoryId(cls.category) : null;

  const flags: string[] = [];
  if (price <= 0) flags.push("no-price");
  if (!categoryId) flags.push("uncategorised");
  else if (cls.confidence < REVIEW_THRESHOLD) flags.push("low-confidence-category");
  if (!woo.description && !woo.short_description) flags.push("no-description");

  const realImages = woo.images.filter((img) => !PLACEHOLDER_IMAGE.test(img.src));
  if (woo.images.length > realImages.length) stats.placeholdersSkipped++;
  if (realImages.length === 0) flags.push("no-image");

  /*
   * Rows that are really invoice lines — "Previous Balance", a supplier's
   * company name, unpriced "Petrol". The old site doubled as a billing tool,
   * so they sit in the product table. Imported and preserved, but never
   * published: deleting them silently would destroy the client's own records.
   */
  const invoiceLine = looksLikeInvoiceLine(name);
  if (invoiceLine) flags.push("not-a-product");

  // Reads like a job but scored as a part — a human should confirm which.
  if (!invoiceLine && readsLikeLabour(name)) flags.push("possible-service");

  const needsReview = flags.length > 0;
  const reviewReason = needsReview ? flags.join(", ") : null;

  /*
   * A product with no price is imported but left inactive. Nothing the client
   * typed is thrown away, and nothing shows on the public site priced at
   * Rs. 0.00 — 351 of the 955 products are in this state.
   */
  const isActive = price > 0 && !invoiceLine;

  const existing = await db.product.findUnique({
    where: { wooId: woo.id },
    select: { id: true, sku: true, slug: true },
  });

  const data = {
    name,
    shortDescription: htmlToText(woo.short_description) || null,
    description: htmlToText(woo.description) || null,
    categoryId,
    price: priceStr,
    discountedPrice: woo.on_sale && sale > 0 && sale < price ? saleStr : null,
    condition: detectCondition(name),
    // The old site tracks no stock quantities at all — `is_in_stock` is true
    // for everything, including the 351 products with no price. Importing a
    // fabricated quantity would be worse than importing none, so inventory
    // tracking starts switched off and the storekeeper turns it on per product
    // once real counts exist.
    stockQty: 0,
    trackInventory: false,
    isActive,
    classifiedBy: "IMPORT_KEYWORD" as const,
    classifyConfidence: cls.confidence,
    needsReview,
    reviewReason,
  } satisfies Partial<Prisma.ProductUncheckedCreateInput>;

  if (DRY_RUN) {
    record({
      wooId: woo.id,
      name,
      outcome: existing ? "would-update" : "would-create",
      kind: "part",
      category: cls.category
        ? `${cls.category.parent}${cls.category.child ? ` / ${cls.category.child}` : ""}`
        : "",
      price: priceStr,
      confidence: cls.confidence,
      flags: reviewReason ?? "",
    });
    if (existing) stats.productsUpdated++;
    else stats.productsCreated++;
    return;
  }

  if (existing) {
    await db.product.update({ where: { id: existing.id }, data });
    stats.productsUpdated++;
  } else {
    await db.product.create({
      data: {
        ...data,
        wooId: woo.id,
        sku: makeSku(name, woo.id),
        slug: uniqueSlug(woo.slug || name),
      },
    });
    stats.productsCreated++;
  }

  record({
    wooId: woo.id,
    name,
    outcome: existing ? "updated" : "created",
    kind: "part",
    category: cls.category
      ? `${cls.category.parent}${cls.category.child ? ` / ${cls.category.child}` : ""}`
      : "",
    price: priceStr,
    confidence: cls.confidence,
    flags: reviewReason ?? "",
  });
}

async function importService(woo: WooProduct, cls: Classification) {
  if (cls.kind !== "service") throw new Error("importService called with a part");

  const baseName = decodeEntities(cls.baseName);
  const priceStr = decodeAmount(woo.prices.regular_price, woo.prices.currency_minor_unit);
  const price = Number.parseFloat(priceStr);
  const key = baseName.toLowerCase();

  const categoryId = serviceCategoryIds.get(slugify(cls.category)) ?? null;

  const flags: string[] = [];
  if (price <= 0) flags.push("no-price");
  if (cls.confidence < REVIEW_THRESHOLD) flags.push("low-confidence-category");
  if (!categoryId) flags.push("unknown-service-category");

  /*
   * The same invoice-line check the product path uses.
   *
   * Omitting it here was a real oversight: names like "Advance Payment Done
   * (Undercoating)", "Courier Charges" and "Pickme Charges" are billing rows
   * from the old site, and they sailed through as bookable services and onto
   * the public services page. Deactivated rather than skipped, so the record
   * survives and a human can promote one back if it turns out to be genuine.
   */
  const invoiceLine = looksLikeInvoiceLine(baseName);
  if (invoiceLine) flags.push("not-a-product");

  /*
   * Internal labour lines. "Labour Charge For Coolant Change" is real work,
   * but it is a line item staff add to a bill — not something a customer
   * browses and books. Left inactive so it is available in the admin for
   * quoting without cluttering the storefront with 60 near-identical entries.
   */
  const internalLabourLine = /^(labour|labor|lathe|pickme|courier|breakdown)\b.*\bcharges?\b|\bcharges?$/i.test(
    baseName,
  );
  if (internalLabourLine && !invoiceLine) flags.push("internal-labour-line");

  const publishable = !invoiceLine && !internalLabourLine;

  const outcomeSuffix = cls.vehicleClass ? ` [${cls.vehicleClass}]` : "";

  if (DRY_RUN) {
    const isNew = !serviceIds.has(key);
    if (isNew) {
      serviceIds.set(key, "dry-run");
      stats.servicesCreated++;
    }
    if (cls.vehicleClass) stats.servicePricesWritten++;
    record({
      wooId: woo.id,
      name: `${baseName}${outcomeSuffix}`,
      outcome: isNew ? "would-create-service" : "would-add-price",
      kind: "service",
      category: cls.category,
      price: priceStr,
      confidence: cls.confidence,
      flags: flags.join(", "),
    });
    return;
  }

  // One Service per base name; the Car/Van/SUV variants become its prices.
  let serviceId = serviceIds.get(key);
  if (!serviceId) {
    const existing = await db.service.findFirst({
      where: { name: baseName },
      select: { id: true },
    });
    if (existing) {
      serviceId = existing.id;

      /*
       * Re-apply the publish decision to a service that already exists.
       *
       * Without this, tightening the rules only affects services created from
       * scratch — the invoice lines and internal labour rows imported by an
       * earlier run would stay live on the public site forever. Only ever
       * turned *off* here: if someone has deliberately published one from the
       * admin, a re-import should not quietly override that judgement.
       */
      if (!publishable) {
        await db.service.updateMany({
          where: { id: existing.id, isActive: true },
          data: { isActive: false },
        });
      }
    } else {
      const created = await db.service.create({
        data: {
          name: baseName,
          slug: uniqueSlug(baseName, "svc:"),
          categoryId,
          // Only used when no per-vehicle-class price matches.
          basePrice: cls.vehicleClass ? null : price > 0 ? priceStr : null,
          priceFrom: true,
          isActive: (price > 0 || Boolean(cls.vehicleClass)) && publishable,
          wooId: woo.id,
        },
        select: { id: true },
      });
      serviceId = created.id;
      stats.servicesCreated++;
    }
    serviceIds.set(key, serviceId);
  }

  if (cls.vehicleClass && price > 0) {
    await db.servicePrice.upsert({
      where: {
        serviceId_vehicleClass: {
          serviceId,
          vehicleClass: cls.vehicleClass as VehicleClass,
        },
      },
      create: {
        serviceId,
        vehicleClass: cls.vehicleClass as VehicleClass,
        price: priceStr,
        wooId: woo.id,
      },
      update: { price: priceStr },
    });
    stats.servicePricesWritten++;
  }

  record({
    wooId: woo.id,
    name: `${baseName}${outcomeSuffix}`,
    outcome: "service",
    kind: "service",
    category: cls.category,
    price: priceStr,
    confidence: cls.confidence,
    flags: flags.join(", "),
  });
}

/**
 * Retire product rows that this run did not import as products.
 *
 * Re-running after a classifier change is the normal case, not an edge case:
 * tightening a rule moved nine "Labour Charge …" rows from products to
 * services, and without this pass their old Product rows stayed behind and
 * active — so the same thing appeared on the site twice, once as a part you
 * could buy and once as a service you could book.
 *
 * They are deactivated and flagged rather than deleted. The row may carry
 * history, and destroying the client's data to tidy up a classification is not
 * a trade worth making.
 */
async function reconcileRetiredProducts() {
  if (DRY_RUN) return;

  const stale = await db.product.findMany({
    where: {
      wooId: { not: null, notIn: [...seenAsProduct] },
      isActive: true,
    },
    select: { id: true, name: true, wooId: true },
  });

  for (const product of stale) {
    await db.product.update({
      where: { id: product.id },
      data: {
        isActive: false,
        needsReview: true,
        reviewReason: "reclassified-as-service-or-removed-upstream",
      },
    });
    stats.retired++;
    record({
      wooId: product.wooId ?? 0,
      name: product.name,
      outcome: "retired",
      kind: "part",
      category: "",
      price: "",
      confidence: "",
      flags: "reclassified-as-service-or-removed-upstream",
    });
  }
}

/** A 301 from the old WordPress URL to wherever the thing now lives. */
async function recordRedirect(woo: WooProduct, cls: Classification) {
  const fromPath = `/product/${woo.slug}`;
  const toPath =
    cls.kind === "service"
      ? `/services/${slugify(decodeEntities(cls.baseName))}`
      : `/parts/${woo.slug}`;

  stats.redirects++;
  if (DRY_RUN) return;

  await db.redirect.upsert({
    where: { fromPath },
    create: { fromPath, toPath, statusCode: 301, note: "WooCommerce migration" },
    update: { toPath },
  });
}

async function writeReport() {
  const dir = path.join(process.cwd(), "import-reports");
  await mkdir(dir, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const file = path.join(dir, `woo-import-${DRY_RUN ? "dryrun-" : ""}${stamp}.csv`);

  const escape = (v: string | number) => {
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const csv = [
    "wooId,name,outcome,kind,category,price,confidence,flags",
    ...rows.map((r) =>
      [r.wooId, r.name, r.outcome, r.kind, r.category, r.price, r.confidence, r.flags]
        .map(escape)
        .join(","),
    ),
  ].join("\n");

  await writeFile(file, csv, "utf8");
  return file;
}

function summarise(reportPath: string) {
  const flagCounts = new Map<string, number>();
  for (const row of rows) {
    if (!row.flags) continue;
    for (const flag of row.flags.split(", ")) {
      flagCounts.set(flag, (flagCounts.get(flag) ?? 0) + 1);
    }
  }

  const pct = (n: number) =>
    stats.fetched ? `${((n / stats.fetched) * 100).toFixed(1)}%` : "0%";

  console.log(`\n${"=".repeat(58)}`);
  console.log(DRY_RUN ? "DRY RUN — nothing was written" : "IMPORT COMPLETE");
  console.log("=".repeat(58));
  console.log(`fetched from WooCommerce   ${stats.fetched}`);
  console.log(
    `products                   ${stats.productsCreated} created, ${stats.productsUpdated} updated`,
  );
  console.log(
    `services                   ${stats.servicesCreated} created, ${stats.servicePricesWritten} per-class prices`,
  );
  console.log(`redirects                  ${stats.redirects}`);
  console.log(`images imported            ${stats.imagesImported}`);
  console.log(`placeholder images skipped ${stats.placeholdersSkipped}`);
  console.log(`template demo products skipped ${stats.templateDemoSkipped}`);
  console.log(`skipped                    ${stats.skipped}`);
  console.log(`retired (now inactive)     ${stats.retired}`);
  console.log(
    `\nflagged for review         ${stats.flagged} (${pct(stats.flagged)} of everything)`,
  );
  for (const [flag, count] of [...flagCounts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${flag.padEnd(26)} ${count}`);
  }
  console.log(`\nreport: ${reportPath}\n`);
}

async function main() {
  const source = process.env.WOO_SOURCE_URL ?? "https://cardresssl.com";
  const api = new StoreApi(source);

  console.log(`Source: ${source}`);
  if (DRY_RUN) console.log("Mode:   DRY RUN (no writes)\n");

  const total = await api.countProducts();
  console.log(`Products reported by the API: ${total}\n`);

  await loadTaxonomy();
  console.log(
    `Taxonomy: ${categoryIds.size} part categories, ${serviceCategoryIds.size} service categories`,
  );
  if (categoryIds.size === 0) {
    console.error("\nNo categories found — run `npm run db:seed` first.");
    process.exitCode = 1;
    return;
  }

  for await (const page of api.productPages()) {
    for (const woo of page) {
      if (LIMIT && stats.fetched >= LIMIT) break;
      stats.fetched++;

      const name = decodeEntities(woo.name);
      if (!name) {
        stats.skipped++;
        record({
          wooId: woo.id,
          name: woo.name,
          outcome: "skipped",
          kind: "",
          category: "",
          price: "",
          confidence: "",
          flags: "empty-name",
        });
        continue;
      }

      const categorySlugs = woo.categories.map((c) => c.slug);

      // Houseplants from the WordPress theme's demo content. Not skipped
      // quietly — they are reported so the decision is visible.
      if (isTemplateDemoProduct(name, categorySlugs)) {
        stats.skipped++;
        stats.templateDemoSkipped++;
        record({
          wooId: woo.id,
          name,
          outcome: "skipped",
          kind: "",
          category: "",
          price: "",
          confidence: "",
          flags: "template-demo-content",
        });
        continue;
      }

      const cls = classify(name, categorySlugs);

      if (cls.kind === "service") await importService(woo, cls);
      else await importProduct(woo, cls);

      await recordRedirect(woo, cls);
    }
    process.stdout.write(`  processed ${stats.fetched}\r`);
    if (LIMIT && stats.fetched >= LIMIT) break;
  }

  await reconcileRetiredProducts();

  const reportPath = await writeReport();
  summarise(reportPath);
}

main()
  .catch((error) => {
    console.error("\nImport failed:", error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
