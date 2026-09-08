import { effectivePrice } from "@/lib/money";
import { toOpeningHoursSpec } from "@/lib/opening-hours";
import type { Settings } from "@/lib/settings";

/**
 * JSON-LD structured data.
 *
 * Two concrete payoffs, not decoration: `AutoRepair` is what puts a workshop
 * into Google's local pack with its hours and phone number, and `Product` with
 * an `offers` block is what shows a price under a search result instead of a
 * bare blue link.
 *
 * Rendered with a plain <script type="application/ld+json">. React does not
 * escape the contents of a script tag, so every value is serialised through
 * JSON.stringify and the closing-tag sequence is neutralised below.
 */

/** Guard against a stray `</script>` inside user-entered content. */
function serialise(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger -- JSON-LD has no other route
      dangerouslySetInnerHTML={{ __html: serialise(data) }}
    />
  );
}

/** The business itself. Rendered once, in the public layout. */
export function BusinessJsonLd({
  settings,
  baseUrl,
}: {
  settings: Settings;
  baseUrl: string;
}) {
  const address = {
    "@type": "PostalAddress",
    streetAddress:
      [settings["contact.addressLine1"], settings["contact.addressLine2"]]
        .filter(Boolean)
        .join(", ") || undefined,
    addressLocality: settings["contact.city"] || undefined,
    addressCountry: "LK",
  };

  const socials = [
    settings["social.facebook"],
    settings["social.instagram"],
    settings["social.tiktok"],
    settings["social.youtube"],
  ].filter(Boolean);

  const hours = toOpeningHoursSpec({
    weekday: settings["hours.weekday"],
    saturday: settings["hours.saturday"],
    sunday: settings["hours.sunday"],
  });

  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "AutoRepair",
        "@id": `${baseUrl}/#business`,
        name: settings["site.name"] || "Car Dress SL",
        description: settings["site.description"] || undefined,
        url: baseUrl,
        telephone: settings["contact.phone"] || undefined,
        email: settings["contact.email"] || undefined,
        // Only emit an address once there is something in it — an empty
        // PostalAddress is worse than none at all.
        address: address.streetAddress || address.addressLocality ? address : undefined,
        openingHours: hours.length ? hours : undefined,
        sameAs: socials.length ? socials : undefined,
        priceRange: "$$",
        currenciesAccepted: settings["commerce.currency"] || "LKR",
        areaServed: { "@type": "Country", name: "Sri Lanka" },
      }}
    />
  );
}

/** A single part, with its price, for rich results. */
export function ProductJsonLd({
  product,
  baseUrl,
  currency = "LKR",
}: {
  product: {
    name: string;
    slug: string;
    sku: string;
    partNumber: string | null;
    description: string | null;
    shortDescription: string | null;
    price: unknown;
    discountedPrice: unknown;
    condition: string;
    trackInventory: boolean;
    stockQty: number;
    brand: { name: string } | null;
    images: { url: string }[];
  };
  baseUrl: string;
  currency?: string;
}) {
  const url = `${baseUrl}/parts/${product.slug}`;

  // schema.org has a fixed vocabulary for condition; map ours onto it.
  const conditionMap: Record<string, string> = {
    NEW: "https://schema.org/NewCondition",
    USED: "https://schema.org/UsedCondition",
    REFURBISHED: "https://schema.org/RefurbishedCondition",
    OEM: "https://schema.org/NewCondition",
    AFTERMARKET: "https://schema.org/NewCondition",
  };

  const inStock = !product.trackInventory || product.stockQty > 0;

  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "Product",
        name: product.name,
        sku: product.sku,
        mpn: product.partNumber || undefined,
        description:
          product.shortDescription || product.description || undefined,
        image: product.images.length
          ? product.images.map((i) => i.url)
          : undefined,
        brand: product.brand
          ? { "@type": "Brand", name: product.brand.name }
          : undefined,
        offers: {
          "@type": "Offer",
          url,
          priceCurrency: currency,
          price: effectivePrice(product as never).toString(),
          itemCondition: conditionMap[product.condition],
          availability: inStock
            ? "https://schema.org/InStock"
            : "https://schema.org/OutOfStock",
          seller: { "@id": `${baseUrl}/#business` },
        },
      }}
    />
  );
}

/** Breadcrumbs, so search results show the category path. */
export function BreadcrumbJsonLd({
  trail,
  baseUrl,
}: {
  trail: { name: string; path: string }[];
  baseUrl: string;
}) {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: trail.map((item, index) => ({
          "@type": "ListItem",
          position: index + 1,
          name: item.name,
          item: `${baseUrl}${item.path}`,
        })),
      }}
    />
  );
}
