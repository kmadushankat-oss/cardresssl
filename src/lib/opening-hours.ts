/**
 * Turn the free-text opening hours the owner types into the format
 * schema.org's `openingHours` expects.
 *
 * The Settings page accepts plain text on purpose — asking a workshop owner to
 * enter times in ISO format would be a worse product — so this has to cope
 * with "8:30 AM – 6:00 PM", "08:30-18:00", "9am to 5pm" and "Closed".
 *
 * Anything it cannot confidently read returns null and is simply omitted from
 * the structured data. A wrong opening time in Google is worse than none: it
 * sends customers to a closed workshop.
 */

/** "6:00 PM" -> "18:00". Returns null if unreadable. */
export function to24Hour(raw: string): string | null {
  const match = raw.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?$/i);
  if (!match) return null;

  let hour = Number.parseInt(match[1], 10);
  const minute = match[2] ?? "00";
  const meridiem = match[3]?.toLowerCase().replace(/\./g, "");

  if (Number.isNaN(hour) || hour > 24) return null;
  if (Number.parseInt(minute, 10) > 59) return null;

  if (meridiem === "pm" && hour < 12) hour += 12;
  if (meridiem === "am" && hour === 12) hour = 0;

  // Without a meridiem the number is taken at face value, so "18:00" works.
  if (hour > 23) return null;

  return `${String(hour).padStart(2, "0")}:${minute}`;
}

/** "8:30 AM – 6:00 PM" -> "08:30-18:00". Null for closed or unparseable. */
export function parseHoursRange(value: string): string | null {
  const text = (value ?? "").trim();
  if (!text) return null;
  if (/closed|by appointment/i.test(text)) return null;

  // Split on the range separator: hyphen, en/em dash, "to", or "till".
  const parts = text.split(/\s*(?:[-–—]|\bto\b|\btill\b|\buntil\b)\s*/i).filter(Boolean);
  if (parts.length < 2) return null;

  const open = to24Hour(parts[0]);
  const close = to24Hour(parts[parts.length - 1]);
  if (!open || !close) return null;

  return `${open}-${close}`;
}

export type HoursSettings = {
  weekday: string;
  saturday: string;
  sunday: string;
};

/** The schema.org `openingHours` array, omitting any day it cannot read. */
export function toOpeningHoursSpec(hours: HoursSettings): string[] {
  const spec: string[] = [];

  const weekday = parseHoursRange(hours.weekday);
  if (weekday) spec.push(`Mo-Fr ${weekday}`);

  const saturday = parseHoursRange(hours.saturday);
  if (saturday) spec.push(`Sa ${saturday}`);

  const sunday = parseHoursRange(hours.sunday);
  if (sunday) spec.push(`Su ${sunday}`);

  return spec;
}
