import { z } from "zod";

/**
 * Fail loudly at boot if the environment is misconfigured, rather than at 2am
 * when someone tries to email a booking confirmation.
 *
 * Optional integrations (Resend, Vercel Blob) are allowed to be empty — each
 * has a documented development fallback — but the code that uses them checks
 * `isMailConfigured` / `isBlobConfigured` rather than guessing.
 */
const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  BETTER_AUTH_SECRET: z
    .string()
    .min(32, "BETTER_AUTH_SECRET must be at least 32 characters"),
  BETTER_AUTH_URL: z.string().url(),
  NEXT_PUBLIC_APP_URL: z.string().url(),

  RESEND_API_KEY: z.string().default(""),
  MAIL_FROM: z.string().default("Car Dress SL <no-reply@cardresssl.com>"),
  MAIL_REPLY_TO: z.string().default(""),
  MAIL_NOTIFY_TO: z.string().default(""),

  BLOB_READ_WRITE_TOKEN: z.string().default(""),

  WOO_SOURCE_URL: z.string().url().default("https://cardresssl.com"),

  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
    .join("\n");
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

export const env = parsed.data;

export const isProduction = env.NODE_ENV === "production";

/** Real email is only sent when Resend is configured. */
export const isMailConfigured = env.RESEND_API_KEY.length > 0;

/** Blob storage is only used when a token is present. */
export const isBlobConfigured = env.BLOB_READ_WRITE_TOKEN.length > 0;
