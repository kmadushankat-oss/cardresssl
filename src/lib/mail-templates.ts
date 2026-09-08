import { notifyAddress, sendMail, type SendMailResult } from "@/lib/mail";
import type { Settings } from "@/lib/settings";

/**
 * Transactional email bodies.
 *
 * Plain inline-styled HTML on purpose: every serious mail client strips
 * stylesheets, and half of these will be opened in Gmail on a phone. The
 * layout is a single column with generous tap targets and nothing that breaks
 * when images are blocked.
 */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function shell({
  heading,
  body,
  settings,
}: {
  heading: string;
  body: string;
  settings: Settings;
}): string {
  const name = escapeHtml(settings["site.name"] || "Car Dress SL");
  const phone = settings["contact.phone"];
  const address = [
    settings["contact.addressLine1"],
    settings["contact.addressLine2"],
    settings["contact.city"],
  ]
    .filter(Boolean)
    .join(", ");

  return `
<div style="margin:0;padding:24px 12px;background:#f5f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;border:1px solid #e7e5e4;">
    <tr>
      <td style="padding:20px 24px;border-bottom:1px solid #e7e5e4;">
        <span style="font-size:18px;font-weight:700;color:#1c1917;letter-spacing:-0.01em;">CAR <span style="color:#ea580c;">DRESS</span> <span style="font-size:11px;color:#78716c;">SL</span></span>
      </td>
    </tr>
    <tr>
      <td style="padding:24px;">
        <h1 style="margin:0 0 12px;font-size:20px;line-height:1.3;color:#1c1917;">${escapeHtml(heading)}</h1>
        ${body}
      </td>
    </tr>
    <tr>
      <td style="padding:16px 24px;background:#fafaf9;border-top:1px solid #e7e5e4;font-size:12px;line-height:1.6;color:#78716c;">
        ${name}${address ? `<br>${escapeHtml(address)}` : ""}
        ${phone ? `<br>Phone: <a href="tel:${escapeHtml(phone.replace(/\s/g, ""))}" style="color:#ea580c;text-decoration:none;">${escapeHtml(phone)}</a>` : ""}
      </td>
    </tr>
  </table>
</div>`.trim();
}

function detailRows(rows: [string, string | null | undefined][]): string {
  const present = rows.filter(([, value]) => value);
  if (present.length === 0) return "";

  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:16px 0;font-size:14px;color:#1c1917;">
  ${present
    .map(
      ([label, value]) => `
  <tr>
    <td style="padding:6px 12px 6px 0;color:#78716c;white-space:nowrap;vertical-align:top;">${escapeHtml(label)}</td>
    <td style="padding:6px 0;vertical-align:top;">${escapeHtml(String(value))}</td>
  </tr>`,
    )
    .join("")}
</table>`.trim();
}

export type BookingEmailInput = {
  bookingNumber: string;
  name: string;
  preferredDate: string;
  preferredTime: string | null;
  serviceNames: string[];
  settings: Settings;
};

/** Confirmation to the customer. Deliberately does not promise a slot. */
export async function sendBookingReceivedEmail(
  input: BookingEmailInput & { to: string },
): Promise<SendMailResult> {
  const { bookingNumber, name, preferredDate, preferredTime, serviceNames, settings } =
    input;

  const body = `
<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#44403c;">
  Thanks ${escapeHtml(name.split(" ")[0])} — we have your request and will call you shortly to confirm a time.
</p>
${detailRows([
  ["Reference", bookingNumber],
  ["Requested", formatDate(preferredDate)],
  ["Preferred time", preferredTime],
  ["Services", serviceNames.length ? serviceNames.join(", ") : "To be discussed"],
])}
<p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:#78716c;">
  This is a request, not a confirmed appointment — we will ring you to agree the
  time. If you need to change anything, just reply or give us a call.
</p>`.trim();

  return sendMail({
    to: input.to,
    subject: `We have your booking request (${bookingNumber})`,
    html: shell({ heading: "Booking request received", body, settings }),
  });
}

/** Internal alert so the front desk sees a new request without watching the dashboard. */
export async function sendStaffBookingAlert(input: {
  bookingNumber: string;
  name: string;
  phone: string;
  preferredDate: string;
  preferredTime: string | null;
  serviceNames: string[];
  vehicle: string;
  notes: string | null;
  settings: Settings;
}): Promise<SendMailResult | null> {
  const to = notifyAddress();
  if (!to) return null;

  const body = `
${detailRows([
  ["Reference", input.bookingNumber],
  ["Customer", input.name],
  ["Phone", input.phone],
  ["Requested", formatDate(input.preferredDate)],
  ["Preferred time", input.preferredTime],
  ["Vehicle", input.vehicle || "Not given"],
  ["Services", input.serviceNames.length ? input.serviceNames.join(", ") : "Not specified"],
  ["Notes", input.notes],
])}
<p style="margin:16px 0 0;font-size:13px;color:#78716c;">
  Open the dashboard to confirm or reschedule.
</p>`.trim();

  return sendMail({
    to,
    subject: `New booking: ${input.name} — ${input.bookingNumber}`,
    html: shell({ heading: "New booking request", body, settings: input.settings }),
  });
}

/** Internal alert for a contact-form message. */
export async function sendStaffEnquiryAlert(input: {
  name: string;
  phone: string;
  email: string | null;
  subject: string | null;
  message: string;
  settings: Settings;
}): Promise<SendMailResult | null> {
  const to = notifyAddress();
  if (!to) return null;

  const body = `
${detailRows([
  ["From", input.name],
  ["Phone", input.phone],
  ["Email", input.email],
  ["Subject", input.subject],
])}
<div style="margin:16px 0;padding:12px;background:#fafaf9;border-radius:8px;font-size:14px;line-height:1.6;color:#1c1917;white-space:pre-wrap;">${escapeHtml(
    input.message,
  )}</div>`.trim();

  return sendMail({
    to,
    subject: `Website enquiry from ${input.name}`,
    replyTo: input.email ?? undefined,
    html: shell({ heading: "New website enquiry", body, settings: input.settings }),
  });
}

/** Acknowledgement to whoever used the contact form. */
export async function sendEnquiryReceivedEmail(input: {
  to: string;
  name: string;
  settings: Settings;
}): Promise<SendMailResult> {
  const body = `
<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#44403c;">
  Thanks ${escapeHtml(input.name.split(" ")[0])} — we have your message and will get back to you as soon as we can.
</p>
<p style="margin:0;font-size:13px;line-height:1.6;color:#78716c;">
  If it is urgent, calling us is always quicker.
</p>`.trim();

  return sendMail({
    to: input.to,
    subject: "We have your message",
    html: shell({ heading: "Message received", body, settings: input.settings }),
  });
}
