/**
 * Idempotent seed: safe to run repeatedly against the same database.
 *
 * Creates the owner login, the part-type category tree the WooCommerce
 * importer classifies into, service categories, and default site settings.
 *
 *   npm run db:seed
 */
import "dotenv/config";

import { db } from "../src/lib/db";
import { SETTING_DEFAULTS, settingGroup } from "../src/lib/settings";
import { slugify } from "../src/lib/utils";

/**
 * The taxonomy customers actually browse by. The old site had only
 * Car / Van / SUV, which tells a shopper nothing about what a part is.
 */
const CATEGORY_TREE: { name: string; icon: string; children: string[] }[] = [
  {
    name: "Brakes",
    icon: "disc-3",
    children: [
      "Brake Pads",
      "Brake Discs & Drums",
      "Brake Hoses & Lines",
      "Master & Wheel Cylinders",
      "Handbrake Parts",
    ],
  },
  {
    name: "Suspension & Steering",
    icon: "car-front",
    children: [
      "Shock Absorbers & Struts",
      "Springs",
      "Control Arms & Ball Joints",
      "Tie Rods & Rack Ends",
      "Bushes & Mounts",
      "Stabiliser Links",
      "Power Steering",
    ],
  },
  {
    name: "Engine & Drivetrain",
    icon: "cog",
    children: [
      "Belts & Tensioners",
      "Engine Mounts",
      "Gaskets & Seals",
      "Clutch & Pressure Plates",
      "Timing Components",
      "Water Pumps & Cooling",
      "Turbo & Intake",
      "Exhaust & Emissions",
    ],
  },
  {
    name: "Electrical & Batteries",
    icon: "battery-charging",
    children: [
      "Batteries",
      "Alternators & Starters",
      "Relays & Fuses",
      "Sensors",
      "Switches & Controls",
      "Wiring & Connectors",
      "Ignition Coils & Plugs",
    ],
  },
  {
    name: "Filters",
    icon: "filter",
    children: ["Oil Filters", "Air Filters", "Fuel Filters", "Cabin & AC Filters"],
  },
  {
    name: "Fluids & Oils",
    icon: "droplets",
    children: [
      "Engine Oil",
      "Gear & Transmission Oil",
      "Brake Fluid",
      "Coolant",
      "Greases & Additives",
    ],
  },
  {
    name: "Body & Exterior",
    icon: "car",
    children: [
      "Bumpers & Grilles",
      "Fenders & Panels",
      "Mirrors",
      "Bonnets & Boots",
      "Badges & Trim",
      "Wipers",
      "Glass & Weather Strips",
      "Body Kits & Skirts",
    ],
  },
  {
    name: "Lighting",
    icon: "lightbulb",
    children: [
      "Headlights",
      "Tail Lights",
      "Indicators & Side Lamps",
      "Bulbs & LEDs",
      "Fog & Auxiliary Lights",
    ],
  },
  {
    name: "Interior & Accessories",
    icon: "armchair",
    children: [
      "Seat Covers & Cushions",
      "Floor Mats",
      "Dashboard & AC Vents",
      "Steering Wheels & Covers",
      "Audio & Multimedia",
      "Phone Mounts & Chargers",
      "Storage & Organisers",
    ],
  },
  {
    name: "Wheels & Tyres",
    icon: "circle-dot",
    children: ["Alloy Wheels", "Wheel Caps & Nuts", "Tyres", "Valves & Sensors"],
  },
  {
    name: "Car Care & Detailing",
    icon: "sparkles",
    children: [
      "Shampoos & Washes",
      "Polishes & Waxes",
      "Interior Cleaners",
      "Coatings & Sealants",
      "Cloths & Applicators",
      "Air Fresheners",
    ],
  },
];

const SERVICE_CATEGORIES: { name: string; icon: string }[] = [
  { name: "Servicing & Maintenance", icon: "wrench" },
  { name: "Mechanical Repairs", icon: "cog" },
  { name: "Body & Paint", icon: "spray-can" },
  { name: "Detailing & Cleaning", icon: "sparkles" },
  { name: "Electrical & Air Conditioning", icon: "zap" },
  { name: "Tyres & Wheel Alignment", icon: "circle-dot" },
];

async function seedOwner() {
  const email = process.env.SEED_OWNER_EMAIL;
  const password = process.env.SEED_OWNER_PASSWORD;
  const name = process.env.SEED_OWNER_NAME ?? "Owner";

  if (!email || !password) {
    console.log("  · skipped owner (SEED_OWNER_EMAIL / SEED_OWNER_PASSWORD not set)");
    return;
  }

  const existing = await db.user.findUnique({
    where: { email },
    include: { accounts: { where: { providerId: "credential" } } },
  });

  if (existing) {
    if (existing.role !== "OWNER" || !existing.isActive) {
      await db.user.update({
        where: { id: existing.id },
        data: { role: "OWNER", isActive: true },
      });
      console.log(`  · promoted existing user to OWNER: ${email}`);
    }

    // A user row with no credential account cannot sign in. That happens if an
    // earlier sign-up was interrupted part-way through. Repair it rather than
    // leaving a login that silently never works.
    if (existing.accounts.length === 0) {
      const { hashPassword } = await import("better-auth/crypto");
      // better-auth namespaces local credentials as `local:credential`, and
      // sign-in matches on that exact issuer — so derive it rather than
      // hardcoding the string.
      const { createLocalAccountIssuer } = await import("@better-auth/core/db");
      await db.account.create({
        data: {
          id: crypto.randomUUID(),
          userId: existing.id,
          accountId: existing.id,
          providerId: "credential",
          issuer: createLocalAccountIssuer("credential"),
          password: await hashPassword(password),
        },
      });
      console.log(`  · repaired missing credential account for ${email}`);
    } else {
      // Never reset a password that is already in use.
      console.log(`  · owner already present: ${email}`);
    }
    return;
  }

  // Imported lazily: better-auth pulls in the env module, which must not run
  // before dotenv has populated process.env.
  const { auth } = await import("../src/lib/auth");

  const result = await auth.api.signUpEmail({
    body: { name, email, password },
    asResponse: true,
  });

  if (!result.ok) {
    throw new Error(
      `Could not create the owner account (${result.status}): ${await result.text()}`,
    );
  }

  await db.user.update({
    where: { email },
    data: { role: "OWNER", emailVerified: true, isActive: true },
  });

  console.log(`  · created owner: ${email}`);
  if (password === "ChangeMe123!") {
    console.log("    ⚠ this is the default seed password — change it after signing in");
  }
}

async function seedCategories() {
  let parents = 0;
  let children = 0;

  for (const [index, group] of CATEGORY_TREE.entries()) {
    const parent = await db.category.upsert({
      where: { slug: slugify(group.name) },
      update: { name: group.name, iconName: group.icon, sortOrder: index },
      create: {
        name: group.name,
        slug: slugify(group.name),
        iconName: group.icon,
        sortOrder: index,
        isActive: true,
        isFeatured: index < 6,
      },
    });
    parents++;

    for (const [childIndex, childName] of group.children.entries()) {
      // Prefix the slug with the parent so "Brake Pads" under Brakes cannot
      // collide with a similarly named child elsewhere in the tree.
      const slug = slugify(`${group.name} ${childName}`);
      await db.category.upsert({
        where: { slug },
        update: { name: childName, parentId: parent.id, sortOrder: childIndex },
        create: {
          name: childName,
          slug,
          parentId: parent.id,
          sortOrder: childIndex,
          isActive: true,
        },
      });
      children++;
    }
  }

  console.log(`  · ${parents} top-level categories, ${children} subcategories`);
}

async function seedServiceCategories() {
  for (const [index, category] of SERVICE_CATEGORIES.entries()) {
    await db.serviceCategory.upsert({
      where: { slug: slugify(category.name) },
      update: { name: category.name, iconName: category.icon, sortOrder: index },
      create: {
        name: category.name,
        slug: slugify(category.name),
        iconName: category.icon,
        sortOrder: index,
        isActive: true,
      },
    });
  }
  console.log(`  · ${SERVICE_CATEGORIES.length} service categories`);
}

async function seedSettings() {
  let created = 0;
  for (const [key, value] of Object.entries(SETTING_DEFAULTS)) {
    const existing = await db.setting.findUnique({ where: { key } });
    if (existing) continue; // never overwrite what the owner has edited
    await db.setting.create({
      data: { key, value, group: settingGroup(key) },
    });
    created++;
  }
  console.log(`  · ${created} settings created, ${Object.keys(SETTING_DEFAULTS).length - created} left untouched`);
}

async function main() {
  console.log("Seeding Car Dress SL…\n");

  console.log("Owner account");
  await seedOwner();

  console.log("\nParts categories");
  await seedCategories();

  console.log("\nService categories");
  await seedServiceCategories();

  console.log("\nSite settings");
  await seedSettings();

  console.log("\nDone.");
}

main()
  .catch((error) => {
    console.error("\nSeed failed:", error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
