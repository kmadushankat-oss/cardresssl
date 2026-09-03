import { Resend } from "resend";

import { env, isMailConfigured } from "@/lib/env";

export type SendMailInput = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
  attachments?: { filename: string; content: Buffer }[];
};

export type SendMailResult =
  | { ok: true; id: string | null; delivered: boolean }
  | { ok: false; error: string };

let client: Resend | null = null;

function resend(): Resend {
  client ??= new Resend(env.RESEND_API_KEY);
  return client;
}

/**
 * Send a transactional email.
 *
 * With no `RESEND_API_KEY` configured — the default in development — the
 * message is written to the server console instead of being sent, so local
 * work never depends on a live mail provider and never risks emailing a real
 * customer from a dev machine.
 */
export async function sendMail(input: SendMailInput): Promise<SendMailResult> {
  const recipients = Array.isArray(input.to) ? input.to : [input.to];

  if (!isMailConfigured) {
    console.info(
      [
        "",
        "─── email (not sent: RESEND_API_KEY is empty) ───",
        `To:      ${recipients.join(", ")}`,
        `Subject: ${input.subject}`,
        "",
        input.text ?? stripHtml(input.html),
        "────────────────────────────────────────────────",
        "",
      ].join("\n"),
    );
    return { ok: true, id: null, delivered: false };
  }

  try {
    const { data, error } = await resend().emails.send({
      from: env.MAIL_FROM,
      to: recipients,
      subject: input.subject,
      html: input.html,
      text: input.text ?? stripHtml(input.html),
      replyTo: input.replyTo ?? (env.MAIL_REPLY_TO || undefined),
      attachments: input.attachments,
    });

    if (error) {
      console.error("[mail] Resend rejected the message", error);
      return { ok: false, error: error.message };
    }

    return { ok: true, id: data?.id ?? null, delivered: true };
  } catch (error) {
    console.error("[mail] send failed", error);
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Unknown mail error",
    };
  }
}

/** Where internal notifications (new booking, new enquiry) should land. */
export function notifyAddress(): string | null {
  return env.MAIL_NOTIFY_TO || null;
}

/** Crude HTML-to-text for the plain-text alternative part. */
function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
