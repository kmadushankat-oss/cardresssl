/**
 * Read-only client for the old site's WooCommerce Store API.
 *
 * The endpoint is public, so the migration needs no credentials:
 *   https://cardresssl.com/wp-json/wc/store/v1/products
 */

export type WooPrices = {
  price: string;
  regular_price: string;
  sale_price: string;
  currency_code: string;
  /** Decimal places the amounts above are expressed in. Almost always 2. */
  currency_minor_unit: number;
};

export type WooImage = {
  id: number;
  src: string;
  name: string;
  alt: string;
};

export type WooTerm = {
  id: number;
  name: string;
  slug: string;
};

export type WooProduct = {
  id: number;
  name: string;
  slug: string;
  type: string;
  permalink: string;
  sku: string;
  short_description: string;
  description: string;
  on_sale: boolean;
  prices: WooPrices;
  images: WooImage[];
  categories: WooTerm[];
  tags: WooTerm[];
  is_in_stock: boolean;
  is_purchasable: boolean;
  weight: string;
};

const MAX_PER_PAGE = 100;

export class StoreApi {
  constructor(private readonly baseUrl: string) {}

  private get productsUrl(): string {
    return `${this.baseUrl.replace(/\/+$/, "")}/wp-json/wc/store/v1/products`;
  }

  /** Total product count, from the `X-WP-Total` response header. */
  async countProducts(): Promise<number> {
    const res = await this.request(`${this.productsUrl}?per_page=1`);
    return Number.parseInt(res.headers.get("x-wp-total") ?? "0", 10);
  }

  /**
   * Every product, one page at a time. Yields pages rather than accumulating
   * the lot so the importer can report progress and stay flat in memory.
   */
  async *productPages(): AsyncGenerator<WooProduct[]> {
    for (let page = 1; ; page++) {
      const res = await this.request(
        `${this.productsUrl}?per_page=${MAX_PER_PAGE}&page=${page}`,
      );
      const batch = (await res.json()) as WooProduct[];
      if (batch.length === 0) return;
      yield batch;
      if (batch.length < MAX_PER_PAGE) return;
    }
  }

  async fetchImage(url: string): Promise<Buffer | null> {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      return Buffer.from(await res.arrayBuffer());
    } catch {
      return null;
    }
  }

  /** GET with a few retries — the source is a shared-hosting WordPress box. */
  private async request(url: string, attempt = 1): Promise<Response> {
    const MAX_ATTEMPTS = 4;
    try {
      const res = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(45_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
      return res;
    } catch (error) {
      if (attempt >= MAX_ATTEMPTS) throw error;
      // Back off: 1s, 2s, 4s.
      await new Promise((r) => setTimeout(r, 1000 * 2 ** (attempt - 1)));
      return this.request(url, attempt + 1);
    }
  }
}

/**
 * Convert a Store API amount to a decimal string.
 *
 * Amounts arrive in *minor units*: "80000" with `currency_minor_unit: 2` is
 * Rs. 800.00, not Rs. 80,000. Verified against the live site, which shows
 * රු800.00 for that product. Getting this wrong inflates every price 100x.
 */
export function decodeAmount(raw: string, minorUnit: number): string {
  const digits = (raw ?? "").trim();
  if (digits === "") return "0";

  const negative = digits.startsWith("-");
  const value = negative ? digits.slice(1) : digits;
  if (!/^\d+$/.test(value)) {
    // Some installs return already-decimal strings; take them at face value.
    const parsed = Number.parseFloat(digits);
    return Number.isFinite(parsed) ? parsed.toFixed(2) : "0";
  }

  if (minorUnit <= 0) return `${negative ? "-" : ""}${value}.00`;

  const padded = value.padStart(minorUnit + 1, "0");
  const whole = padded.slice(0, -minorUnit);
  const fraction = padded.slice(-minorUnit);
  return `${negative ? "-" : ""}${whole}.${fraction.padEnd(2, "0").slice(0, 2)}`;
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  hellip: "…",
  ndash: "–",
  mdash: "—",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  deg: "°",
};

/**
 * Decode HTML entities in a WordPress title.
 *
 * Product names come through encoded — "Exterior Wash &#038; Machine Wax" —
 * and storing that verbatim would print the ampersand escape on the new site.
 */
export function decodeEntities(input: string): string {
  return (input ?? "")
    .replace(/&#(\d+);/g, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 10)),
    )
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    )
    .replace(/&([a-z]+);/gi, (match, name: string) => ENTITIES[name.toLowerCase()] ?? match)
    .replace(/\s+/g, " ")
    .trim();
}

/** Strip tags and decode entities — for turning a WP description into text. */
export function htmlToText(input: string): string {
  return decodeEntities(
    (input ?? "")
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
      .replace(/<[^>]+>/g, ""),
  );
}
