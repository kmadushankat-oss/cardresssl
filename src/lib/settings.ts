import { unstable_cache } from "next/cache";

import { db } from "@/lib/db";

/**
 * Site configuration the owner edits from the admin dashboard, rather than
 * values hard-coded in components. Phone numbers and opening hours change; a
 * deploy should not be required to change them.
 */
export const SETTING_DEFAULTS = {
  "site.name": "Car Dress SL",
  "site.tagline": "Vehicle Service Centre, Mechanical Repairs & Auto Spare Parts",
  "site.description":
    "Full-service vehicle care in Sri Lanka — servicing, mechanical repairs, body work, detailing and genuine spare parts.",

  "contact.phone": "",
  "contact.phoneAlt": "",
  "contact.whatsapp": "",
  "contact.email": "",
  "contact.addressLine1": "",
  "contact.addressLine2": "",
  "contact.city": "",
  "contact.mapEmbedUrl": "",

  "hours.weekday": "8:30 AM – 6:00 PM",
  "hours.saturday": "8:30 AM – 5:00 PM",
  "hours.sunday": "Closed",
  "hours.note": "",

  "social.facebook": "",
  "social.instagram": "",
  "social.tiktok": "",
  "social.youtube": "",

  "commerce.currency": "LKR",
  "commerce.defaultTaxRate": "0",
  "commerce.showPricesToPublic": "true",
  "commerce.enquiryOnly": "true",

  "booking.leadTimeHours": "24",
  "booking.slots": "08:30,10:00,11:30,13:30,15:00,16:30",
} as const;

export type SettingKey = keyof typeof SETTING_DEFAULTS;

export type Settings = Record<SettingKey, string>;

/**
 * Every setting, with defaults filled in for keys not yet stored.
 *
 * Cached because the header, footer and contact blocks all need it on every
 * page render; the cache is invalidated by tag whenever settings are saved.
 */
export const getSettings = unstable_cache(
  async (): Promise<Settings> => {
    const rows = await db.setting.findMany();
    const stored = new Map(rows.map((r) => [r.key, r.value]));

    const result = {} as Settings;
    for (const key of Object.keys(SETTING_DEFAULTS) as SettingKey[]) {
      result[key] = stored.get(key) ?? SETTING_DEFAULTS[key];
    }
    return result;
  },
  ["settings"],
  { tags: ["settings"], revalidate: 3600 },
);

export async function getSetting(key: SettingKey): Promise<string> {
  const settings = await getSettings();
  return settings[key];
}

export function settingGroup(key: string): string {
  return key.split(".")[0] ?? "general";
}
