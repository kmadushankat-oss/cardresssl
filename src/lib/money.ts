import { Prisma } from "@/generated/prisma/client";

const Dec = Prisma.Decimal;
export type DecimalLike = Prisma.Decimal | number | string;

export const DEFAULT_CURRENCY = "LKR";

export function dec(value: DecimalLike | null | undefined): Prisma.Decimal {
  if (value === null || value === undefined || value === "") return new Dec(0);
  return new Dec(value);
}

/** Round to 2dp, half-up — the convention customers expect on an invoice. */
export function money(value: DecimalLike | null | undefined): Prisma.Decimal {
  return dec(value).toDecimalPlaces(2, Dec.ROUND_HALF_UP);
}

export function toNumber(value: DecimalLike | null | undefined): number {
  return dec(value).toNumber();
}

/**
 * Format for display. Server and client both call this, so it must not depend
 * on anything request-scoped.
 */
export function formatMoney(
  value: DecimalLike | null | undefined,
  currency: string = DEFAULT_CURRENCY,
): string {
  const n = toNumber(value);
  const formatted = new Intl.NumberFormat("en-LK", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
  return currency === "LKR" ? `Rs. ${formatted}` : `${currency} ${formatted}`;
}

/** Compact form for cards and listings: "Rs. 12,500" (no cents when whole). */
export function formatPrice(
  value: DecimalLike | null | undefined,
  currency: string = DEFAULT_CURRENCY,
): string {
  const n = toNumber(value);
  if (Number.isInteger(n)) {
    const formatted = new Intl.NumberFormat("en-LK").format(n);
    return currency === "LKR" ? `Rs. ${formatted}` : `${currency} ${formatted}`;
  }
  return formatMoney(value, currency);
}

export type LineInput = {
  quantity: DecimalLike;
  unitPrice: DecimalLike;
  /** Absolute discount on the line, not a percentage. */
  discount?: DecimalLike | null;
  /** Percentage, e.g. 18 for 18%. */
  taxRate?: DecimalLike | null;
};

export type LineTotals = {
  gross: Prisma.Decimal;
  discount: Prisma.Decimal;
  net: Prisma.Decimal;
  tax: Prisma.Decimal;
  lineTotal: Prisma.Decimal;
};

/**
 * One line's arithmetic. `lineTotal` is tax-inclusive so it matches the number
 * printed on the right-hand side of the invoice row.
 */
export function computeLine(input: LineInput): LineTotals {
  const gross = money(dec(input.quantity).times(dec(input.unitPrice)));
  const discount = money(input.discount ?? 0);
  const net = money(gross.minus(discount));
  const tax = money(net.times(dec(input.taxRate ?? 0)).dividedBy(100));
  return { gross, discount, net, tax, lineTotal: money(net.plus(tax)) };
}

export type DocumentTotals = {
  subtotal: Prisma.Decimal;
  discountTotal: Prisma.Decimal;
  taxTotal: Prisma.Decimal;
  total: Prisma.Decimal;
};

/**
 * Roll a set of lines up into document totals.
 *
 * `subtotal` is the gross of all lines *before* discount, so the invoice can
 * show "Subtotal / Discount / Tax / Total" and have the columns add up.
 */
export function computeTotals(
  lines: readonly LineInput[],
  extra: { shippingFee?: DecimalLike | null; documentDiscount?: DecimalLike | null } = {},
): DocumentTotals {
  let subtotal = new Dec(0);
  let discountTotal = money(extra.documentDiscount ?? 0);
  let taxTotal = new Dec(0);
  let net = new Dec(0);

  for (const line of lines) {
    const t = computeLine(line);
    subtotal = subtotal.plus(t.gross);
    discountTotal = discountTotal.plus(t.discount);
    taxTotal = taxTotal.plus(t.tax);
    net = net.plus(t.lineTotal);
  }

  const total = money(
    net.minus(money(extra.documentDiscount ?? 0)).plus(money(extra.shippingFee ?? 0)),
  );

  return {
    subtotal: money(subtotal),
    discountTotal: money(discountTotal),
    taxTotal: money(taxTotal),
    total,
  };
}

/** The price a customer actually pays: the promo price when one is set. */
export function effectivePrice(product: {
  price: DecimalLike;
  discountedPrice?: DecimalLike | null;
}): Prisma.Decimal {
  const discounted = product.discountedPrice;
  if (discounted === null || discounted === undefined) return money(product.price);
  const d = money(discounted);
  // Guard against a promo price that was left higher than the list price.
  return d.greaterThan(0) && d.lessThan(money(product.price)) ? d : money(product.price);
}

/** Whole-percent saving, for the "-25%" badge. Returns 0 when not discounted. */
export function discountPercent(product: {
  price: DecimalLike;
  discountedPrice?: DecimalLike | null;
}): number {
  const list = money(product.price);
  if (list.lessThanOrEqualTo(0)) return 0;
  const effective = effectivePrice(product);
  if (effective.greaterThanOrEqualTo(list)) return 0;
  return Math.round(list.minus(effective).dividedBy(list).times(100).toNumber());
}
