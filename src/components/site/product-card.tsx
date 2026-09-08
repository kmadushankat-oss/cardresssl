import { ImageOff } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { discountPercent, effectivePrice, formatPrice } from "@/lib/money";
import { cn } from "@/lib/utils";

export type ProductCardData = {
  name: string;
  slug: string;
  sku?: string;
  price: unknown;
  discountedPrice: unknown;
  condition?: string;
  stockQty?: number;
  trackInventory?: boolean;
  brand?: { name: string } | null;
  images: { url: string; alt: string | null }[];
};

const CONDITION_LABELS: Record<string, string> = {
  USED: "Used",
  REFURBISHED: "Reconditioned",
  OEM: "Genuine",
  AFTERMARKET: "Aftermarket",
};

/**
 * A catalogue card.
 *
 * Shows the price and the condition up front. The reference site's cards carry
 * neither, so a customer has to open every single product just to learn what
 * it costs — which is the main reason its 3,512-product shop is unusable.
 */
export function ProductCard({
  product,
  priority,
}: {
  product: ProductCardData;
  priority?: boolean;
}) {
  const image = product.images[0];
  const price = effectivePrice({
    price: product.price as never,
    discountedPrice: product.discountedPrice as never,
  });
  const saving = discountPercent({
    price: product.price as never,
    discountedPrice: product.discountedPrice as never,
  });
  const conditionLabel = product.condition
    ? CONDITION_LABELS[product.condition]
    : undefined;

  const outOfStock =
    product.trackInventory === true && (product.stockQty ?? 0) <= 0;

  return (
    <article className="group h-full">
      <Link
        href={`/parts/${product.slug}`}
        className={cn(
          "hover-lift flex h-full flex-col overflow-hidden rounded-card border border-border bg-surface-raised",
          "hover:border-primary/60 focus-visible:border-primary",
        )}
      >
        <div className="relative aspect-square w-full overflow-hidden bg-surface">
          {image ? (
            <Image
              src={image.url}
              alt={image.alt ?? product.name}
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
              priority={priority}
              className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.07]"
            />
          ) : (
            <div className="grid h-full place-items-center">
              <ImageOff className="size-8 text-foreground-subtle" aria-hidden />
            </div>
          )}

          <div className="absolute left-2 top-2 flex flex-col items-start gap-1">
            {saving > 0 && <Badge tone="danger">−{saving}%</Badge>}
            {conditionLabel && <Badge tone="info">{conditionLabel}</Badge>}
          </div>

          {outOfStock && (
            <div className="absolute inset-x-0 bottom-0 bg-ink-950/75 px-2 py-1 text-center text-xs font-medium text-white">
              Out of stock — ask us
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col p-3">
          {product.brand?.name && (
            <p className="text-xs text-foreground-subtle">{product.brand.name}</p>
          )}

          <h3 className="line-clamp-2 text-sm font-medium text-foreground">
            {product.name}
          </h3>

          <p className="mt-auto pt-2">
            <span className="text-base font-semibold tabular-nums">
              {formatPrice(price)}
            </span>
            {saving > 0 && (
              <s className="ml-1.5 text-xs text-foreground-subtle tabular-nums">
                {formatPrice(product.price as never)}
              </s>
            )}
          </p>
        </div>
      </Link>
    </article>
  );
}
