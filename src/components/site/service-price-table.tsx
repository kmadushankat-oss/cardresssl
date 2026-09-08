import { Clock } from "lucide-react";

import { formatPrice } from "@/lib/money";
import { cn } from "@/lib/utils";
import { VEHICLE_CLASS_LABELS, VEHICLE_CLASSES } from "@/lib/validation/service";

type PriceRow = {
  vehicleClass: string;
  price: unknown;
  durationMinutes?: number | null;
};

/**
 * A service's price per vehicle size.
 *
 * The old site sold one job as three separate products — "Cut & Polish (Car)",
 * "(Van)", "(SUV)" — so a customer had to hunt for their own vehicle. Here the
 * classes sit in one table and only the ones actually offered are shown; a
 * blank row means "we don't do this for that vehicle", not "free".
 */
export function ServicePriceTable({
  prices,
  basePrice,
  priceFrom,
  durationMinutes,
  className,
}: {
  prices: PriceRow[];
  basePrice?: unknown;
  priceFrom?: boolean;
  durationMinutes?: number | null;
  className?: string;
}) {
  // Present them in the canonical order rather than however they were entered.
  const ordered = VEHICLE_CLASSES.map((vc) =>
    prices.find((p) => p.vehicleClass === vc),
  ).filter(Boolean) as PriceRow[];

  if (ordered.length === 0) {
    const base = basePrice !== null && basePrice !== undefined ? Number(basePrice) : 0;
    if (base <= 0) {
      return (
        <p className={cn("text-sm text-foreground-muted", className)}>
          Priced on inspection — ask us for a quote.
        </p>
      );
    }
    return (
      <p className={cn("text-sm", className)}>
        <span className="font-semibold tabular-nums">
          {priceFrom ? "From " : ""}
          {formatPrice(basePrice as never)}
        </span>
        {durationMinutes ? (
          <span className="ml-2 inline-flex items-center gap-1 text-foreground-muted">
            <Clock className="size-3.5" aria-hidden />
            about {formatDuration(durationMinutes)}
          </span>
        ) : null}
      </p>
    );
  }

  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full text-sm">
        <caption className="sr-only">Price by vehicle size</caption>
        <thead>
          <tr className="border-b border-border-subtle text-left">
            {ordered.map((row) => (
              <th
                key={row.vehicleClass}
                scope="col"
                className="pb-1.5 pr-4 font-medium text-foreground-muted whitespace-nowrap"
              >
                {VEHICLE_CLASS_LABELS[
                  row.vehicleClass as keyof typeof VEHICLE_CLASS_LABELS
                ] ?? row.vehicleClass}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {ordered.map((row) => (
              <td
                key={row.vehicleClass}
                className="pr-4 pt-2 font-semibold tabular-nums whitespace-nowrap"
              >
                {priceFrom ? (
                  <span className="text-xs font-normal text-foreground-muted">from </span>
                ) : null}
                {formatPrice(row.price as never)}
                {row.durationMinutes ? (
                  <span className="block text-xs font-normal text-foreground-subtle">
                    {formatDuration(row.durationMinutes)}
                  </span>
                ) : null}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (rest === 0) return `${hours} hr${hours === 1 ? "" : "s"}`;
  return `${hours} hr ${rest} min`;
}
