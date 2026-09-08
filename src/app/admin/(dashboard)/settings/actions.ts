"use server";

import { revalidateTag } from "next/cache";
import { z } from "zod";

import { defineAction } from "@/lib/action";
import { revalidateSettings } from "@/lib/cache";
import { db } from "@/lib/db";
import { SETTING_DEFAULTS, settingGroup, type SettingKey } from "@/lib/settings";

const KEYS = Object.keys(SETTING_DEFAULTS) as SettingKey[];

/**
 * Settings arrive as a flat key/value map.
 *
 * Unknown keys are rejected rather than ignored, so a stray form field cannot
 * quietly create configuration the application never reads.
 */
const settingsSchema = z.object({
  values: z.record(z.enum(KEYS as [SettingKey, ...SettingKey[]]), z.string().max(4000)),
});

export const saveSettings = defineAction({
  permission: "settings:manage",
  input: settingsSchema,
  audit: { action: "UPDATE", entity: "Setting" },
  handler: async ({ input, audit }) => {
    const entries = Object.entries(input.values) as [SettingKey, string][];

    // Compare against what is stored so the audit entry names what actually
    // changed, rather than logging "saved settings" on every visit.
    const existing = await db.setting.findMany({
      where: { key: { in: entries.map(([key]) => key) } },
    });
    const before = new Map(existing.map((row) => [row.key, row.value]));

    const changed: string[] = [];
    for (const [key, value] of entries) {
      const previous = before.get(key) ?? SETTING_DEFAULTS[key];
      if (previous === value) continue;
      changed.push(key);

      await db.setting.upsert({
        where: { key },
        create: { key, value, group: settingGroup(key) },
        update: { value },
      });
    }

    audit({
      summary: changed.length
        ? `Changed ${changed.length} setting${changed.length === 1 ? "" : "s"}: ${changed.join(", ")}`
        : "Saved settings with no changes",
      changes: changed.map((key) => ({
        key,
        from: before.get(key) ?? SETTING_DEFAULTS[key as SettingKey],
        to: input.values[key as SettingKey],
      })),
    });

    revalidateSettings();
    // The header, footer and contact blocks read these through a tagged cache.
    revalidateTag("settings", "max");

    return { changed: changed.length };
  },
});
