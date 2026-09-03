# Car Dress SL

Website and admin dashboard for Car Dress SL — a vehicle service centre that
also does mechanical repairs and sells auto spare parts. Replaces the existing
WordPress + WooCommerce site.

- **Stack** — Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4
- **Database** — PostgreSQL via Prisma 7 (Neon in production, Docker locally)
- **Auth** — better-auth with a role-based permission layer
- **Images** — Vercel Blob in production, local disk in development
- **Email** — Resend (logged to the console when no API key is set)

## Getting started

You need Node 20+ (24 recommended) and Docker Desktop running.

```bash
cp .env.example .env   # then fill in the values described in that file
npm install
npm run db:up          # starts Postgres on port 5433
npm run db:deploy      # applies migrations
npm run db:seed        # owner account, category tree, settings
npm run dev
```

Then open http://localhost:3000/admin and sign in with the
`SEED_OWNER_EMAIL` / `SEED_OWNER_PASSWORD` values from your `.env`.

Postgres runs on **5433**, not the default 5432, so it cannot collide with any
other Postgres already on the machine.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` | Production build (generates the Prisma client first) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest — including the RBAC permission matrix |
| `npm run db:up` / `db:down` | Start/stop the local Postgres container |
| `npm run db:migrate` | Create and apply a migration (interactive) |
| `npm run db:deploy` | Apply existing migrations (CI and production) |
| `npm run db:seed` | Idempotent seed — safe to re-run |
| `npm run db:studio` | Prisma Studio |
| `npm run import:woo` | Import the catalogue from the old WooCommerce site |

To create a staff account before the Staff & roles screen exists:

```bash
npx tsx scripts/create-staff.ts --email nimal@cardresssl.com --name "Nimal Perera" --role MECHANIC
```

## Access control

Authorization lives in [`src/lib/permissions.ts`](src/lib/permissions.ts): a flat
list of `resource:action` permission strings, and a `ROLE_PERMISSIONS` map for
eight roles — `OWNER`, `ADMIN`, `MANAGER`, `ACCOUNTANT`, `SERVICE_ADVISOR`,
`MECHANIC`, `STOREKEEPER`, `CUSTOMER`.

Three rules keep it honest:

1. **Nothing checks a role directly.** Pages call `requirePermission()` from
   [`src/lib/session.ts`](src/lib/session.ts); mutations go through
   `defineAction()` in [`src/lib/action.ts`](src/lib/action.ts), which cannot be
   declared without naming a permission. Changing what a role can do is a
   one-line edit in `permissions.ts`.
2. **The sidebar is derived from the same data.** `navForRole()` in
   [`src/lib/admin-nav.ts`](src/lib/admin-nav.ts) filters the nav by the same
   permissions that guard the routes, so a user never sees a link they cannot
   open.
3. **The matrix is tested.** `src/lib/permissions.test.ts` asserts the sensitive
   cases — only the owner may change roles or delete payments, mechanics cannot
   write to the catalogue or see cost prices, and every staff role can reach the
   dashboard.

Session cookie caching is deliberately **disabled** so that deactivating or
demoting a user takes effect on their very next request rather than up to five
minutes later. See the comment in [`src/lib/auth.ts`](src/lib/auth.ts).

## Notes on the old site

Worth knowing when working on the migration:

- The live WordPress site is built on an **"Urban Jungle Co." plant-shop
  template** that was never fully rebranded. Its header still serves that
  company's logo, and its stray `indoor-plants` product category and green
  accent colour come from the same template. **None of that is Car Dress
  branding.** The real brand is orange `#FF4000` with black and white.
- There are roughly **1,400 products**, categorised only by vehicle type
  (Car / Van / SUV / Service). Most have no SKU, no description and a
  placeholder image, so the catalogue needs enriching, not just copying.
- The catalogue mixes parts with **labour priced per vehicle class** — "Body
  Wash – CAR", "– VAN", "– SUV" are three products for one job. Those are folded
  into a single `Service` with three `ServicePrice` rows.
- The **WooCommerce Store API is publicly readable** at
  `/wp-json/wc/store/v1/products`, so the import needs no credentials.
- Around 1,400 URLs are indexed. The `Redirect` table exists so every one of
  them can 301 to its new home at launch — this is a launch blocker, not
  polish.

## Deployment

Vercel, with the domain remaining at Hostinger (DNS only). Required environment
variables are listed in `.env.example`. Set the build command to `npm run build`
and run `npm run db:deploy` as a release step.

Note that **Hostinger shared/web hosting cannot run this app** — it serves PHP
and static files only. Either deploy to Vercel or use a Hostinger VPS.
