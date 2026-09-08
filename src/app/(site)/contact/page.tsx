import { Clock, Mail, MapPin, MessageSquare, Phone } from "lucide-react";
import type { Metadata } from "next";

import { getSettings } from "@/lib/settings";
import { toWhatsAppNumber } from "@/lib/utils";

import { ContactForm } from "./contact-form";

export const metadata: Metadata = {
  title: "Contact us",
  description: "Call, WhatsApp or message us about servicing, repairs or spare parts.",
};

export default async function ContactPage() {
  const settings = await getSettings();

  const phone = settings["contact.phone"];
  const phoneAlt = settings["contact.phoneAlt"];
  const whatsapp = settings["contact.whatsapp"];
  const email = settings["contact.email"];
  const mapUrl = settings["contact.mapEmbedUrl"];

  const address = [
    settings["contact.addressLine1"],
    settings["contact.addressLine2"],
    settings["contact.city"],
  ]
    .filter(Boolean)
    .join(", ");

  const hours = [
    { label: "Monday – Friday", value: settings["hours.weekday"] },
    { label: "Saturday", value: settings["hours.saturday"] },
    { label: "Sunday", value: settings["hours.sunday"] },
  ].filter((h) => h.value);

  const hasAnyContactDetail = Boolean(phone || whatsapp || email || address);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold">Contact us</h1>
        <p className="mt-2 text-foreground-muted">
          Call or WhatsApp for the quickest answer. Otherwise send a message and
          we will come back to you.
        </p>
      </header>

      <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
        <div className="space-y-6">
          {hasAnyContactDetail ? (
            <div className="space-y-2">
              {phone && (
                <a
                  href={`tel:${phone.replace(/\s/g, "")}`}
                  className="flex items-center gap-3 rounded-card border border-border bg-surface-raised p-4 hover:border-primary"
                >
                  <Phone className="size-5 shrink-0 text-primary" aria-hidden />
                  <span>
                    <span className="block text-sm text-foreground-muted">Call us</span>
                    <span className="font-medium">{phone}</span>
                  </span>
                </a>
              )}

              {phoneAlt && (
                <a
                  href={`tel:${phoneAlt.replace(/\s/g, "")}`}
                  className="flex items-center gap-3 rounded-card border border-border bg-surface-raised p-4 hover:border-primary"
                >
                  <Phone className="size-5 shrink-0 text-foreground-muted" aria-hidden />
                  <span>
                    <span className="block text-sm text-foreground-muted">
                      Second line
                    </span>
                    <span className="font-medium">{phoneAlt}</span>
                  </span>
                </a>
              )}

              {whatsapp && (
                <a
                  href={`https://wa.me/${toWhatsAppNumber(whatsapp)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-card border border-border bg-surface-raised p-4 hover:border-primary"
                >
                  <MessageSquare className="size-5 shrink-0 text-success" aria-hidden />
                  <span>
                    <span className="block text-sm text-foreground-muted">WhatsApp</span>
                    <span className="font-medium">{whatsapp}</span>
                  </span>
                </a>
              )}

              {email && (
                <a
                  href={`mailto:${email}`}
                  className="flex items-center gap-3 rounded-card border border-border bg-surface-raised p-4 hover:border-primary"
                >
                  <Mail className="size-5 shrink-0 text-foreground-muted" aria-hidden />
                  <span className="min-w-0">
                    <span className="block text-sm text-foreground-muted">Email</span>
                    <span className="block truncate font-medium">{email}</span>
                  </span>
                </a>
              )}

              {address && (
                <div className="flex items-start gap-3 rounded-card border border-border bg-surface-raised p-4">
                  <MapPin className="mt-0.5 size-5 shrink-0 text-foreground-muted" aria-hidden />
                  <span>
                    <span className="block text-sm text-foreground-muted">Visit us</span>
                    <span className="font-medium">{address}</span>
                  </span>
                </div>
              )}
            </div>
          ) : (
            /*
             * Honest placeholder. None of these details exist anywhere on the
             * old site, so until the owner fills them in on the Settings page
             * there is genuinely nothing to publish here.
             */
            <div className="rounded-card border border-dashed border-border bg-surface-raised p-5 text-sm text-foreground-muted">
              Our contact details are being set up. Please use the message form
              and we will reply as soon as we can.
            </div>
          )}

          {hours.length > 0 && (
            <div className="rounded-card border border-border bg-surface-raised p-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Clock className="size-4 text-foreground-muted" aria-hidden />
                Opening hours
              </h2>
              <dl className="mt-3 space-y-1.5 text-sm">
                {hours.map((h) => (
                  <div key={h.label} className="flex justify-between gap-4">
                    <dt className="text-foreground-muted">{h.label}</dt>
                    <dd className="font-medium">{h.value}</dd>
                  </div>
                ))}
              </dl>
              {settings["hours.note"] && (
                <p className="mt-2 text-xs text-foreground-subtle">
                  {settings["hours.note"]}
                </p>
              )}
            </div>
          )}
        </div>

        <div>
          <ContactForm />
        </div>
      </div>

      {mapUrl && (
        <section className="mt-10">
          <h2 className="mb-3 text-lg font-semibold">Find us</h2>
          <div className="overflow-hidden rounded-card border border-border">
            <iframe
              src={mapUrl}
              title="Our location on a map"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="h-80 w-full border-0"
            />
          </div>
        </section>
      )}
    </div>
  );
}
