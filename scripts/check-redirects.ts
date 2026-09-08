/**
 * Verify every legacy URL ends at a working page.
 *
 *   npx tsx scripts/check-redirects.ts [baseUrl]
 *
 * A 301 into a 404 is worse than leaving the old URL alone: the crawler follows
 * it, finds nothing, and drops the page. So this requests each *old* path and
 * follows the chain to its final status — the end-to-end truth, not what the
 * database intends. This has to pass before DNS is cut over.
 */
import "dotenv/config";

import { db } from "../src/lib/db";

const BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/+$/, "");
const CONCURRENCY = 10;

type Result = {
  fromPath: string;
  finalUrl: string;
  status: number;
  hops: number;
};

async function follow(fromPath: string): Promise<Result> {
  let url = `${BASE}${fromPath}`;
  let hops = 0;

  for (; hops < 5; hops++) {
    let res: Response;
    try {
      res = await fetch(url, { redirect: "manual" });
    } catch {
      return { fromPath, finalUrl: url, status: 0, hops };
    }

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) return { fromPath, finalUrl: url, status: res.status, hops };
      url = new URL(location, url).toString();
      continue;
    }

    return { fromPath, finalUrl: url, status: res.status, hops };
  }

  // Five hops without settling is a loop, which is its own bug.
  return { fromPath, finalUrl: url, status: 508, hops };
}

async function main() {
  const redirects = await db.redirect.findMany({
    where: { isActive: true },
    select: { fromPath: true },
    orderBy: { fromPath: "asc" },
  });

  console.log(`Following ${redirects.length} legacy URLs against ${BASE}\n`);

  const results: Result[] = [];
  for (let i = 0; i < redirects.length; i += CONCURRENCY) {
    const batch = redirects.slice(i, i + CONCURRENCY);
    results.push(...(await Promise.all(batch.map((r) => follow(r.fromPath)))));
    process.stdout.write(`  ${results.length}/${redirects.length}\r`);
  }
  console.log("");

  const ok = results.filter((r) => r.status === 200);
  const broken = results.filter((r) => r.status !== 200);

  // Where did everything end up? Useful for spotting a fallback doing too much
  // work, which would mean a lot of visitors landing somewhere generic.
  const destinations = new Map<string, number>();
  for (const r of ok) {
    const path = new URL(r.finalUrl).pathname + new URL(r.finalUrl).search;
    destinations.set(path, (destinations.get(path) ?? 0) + 1);
  }

  console.log(`resolving to a live page : ${ok.length}/${results.length}`);
  console.log(`broken                   : ${broken.length}`);
  console.log(
    `redirect hops            : max ${Math.max(0, ...results.map((r) => r.hops))}`,
  );

  console.log("\nBusiest destinations:");
  [...destinations.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .forEach(([path, count]) =>
      console.log(`  ${String(count).padStart(4)} -> ${path}`),
    );

  if (broken.length > 0) {
    console.log("\nBroken:");
    broken.slice(0, 20).forEach((r) =>
      console.log(`  HTTP ${r.status}  ${r.fromPath} -> ${r.finalUrl}`),
    );
    process.exitCode = 1;
  } else {
    console.log("\nEvery legacy URL ends at a live page.");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
