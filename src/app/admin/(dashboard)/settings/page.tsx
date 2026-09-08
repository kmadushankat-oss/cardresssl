import { Info } from "lucide-react";
import type { Metadata } from "next";

import { PageHeader } from "@/components/admin/page-header";
import { can } from "@/lib/permissions";
import { getSettings } from "@/lib/settings";
import { requirePermission } from "@/lib/session";

import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requirePermission("settings:view");
  const settings = await getSettings();
  const canEdit = can(user.role, "settings:manage");

  const missing = (
    ["contact.phone", "contact.whatsapp", "contact.addressLine1"] as const
  ).filter((key) => !settings[key]);

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Business details used across the website. Changing them here does not need a deploy."
      />

      {missing.length > 0 && (
        <div className="mb-5 flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
          <Info className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>
            The phone number, WhatsApp number and address are still empty. None
            of them appear anywhere on the old site, so they have to be filled in
            here before the public pages can show contact details.
          </span>
        </div>
      )}

      {!canEdit && (
        <div className="mb-5 rounded-lg border border-border bg-surface p-3 text-sm text-foreground-muted">
          You can see these settings but not change them.
        </div>
      )}

      <SettingsForm settings={settings} canEdit={canEdit} />
    </div>
  );
}
