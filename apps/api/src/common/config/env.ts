import {
  PLATFORM_DEFAULT_FEE_BPS,
  PLATFORM_PAYSTACK_PUBLIC,
  PLATFORM_PAYSTACK_SECRET,
} from "./payments.config";
import { resolve } from "node:path";
import { config } from "dotenv";
import { z } from "zod";

function loadEnv(): void {
  config({ path: resolve(process.cwd(), "../../.env"), quiet: true });
  config({ path: resolve(process.cwd(), ".env"), quiet: true });
}

/**
 * Email addresses allowed to see cross-tenant platform data.
 *
 * An allow-list of identities rather than a role on a user row on purpose: a
 * platform administrator can act on any tenant, so the grant must be deliberate
 * and reviewable, never something an organization owner can hand out.
 */
const platformAdminEmails = z
  .union([z.string(), z.array(z.string())])
  .optional()
  .transform((value) => {
    if (!value) return [] as string[];
    const list = Array.isArray(value) ? value : value.split(",");
    return list.map((email) => email.trim().toLowerCase()).filter(Boolean);
  });

const apiEnvSchema = z.object({
  INVOICE_STORAGE_DIR: z.string().default(".data/invoices"),
  TERMII_API_KEY: z.string().optional(),
  TERMII_BASE_URL: z.string().url().default("https://api.ng.termii.com"),
  TERMII_SENDER_ID: z.string().optional(),
  API_PORT: z.coerce.number().int().positive().default(3001),
  /**
   * Every origin the browser is allowed to call this API from.
   *
   * A comma-separated list rather than a single URL because the same app is
   * reached as `localhost`, as `127.0.0.1`, and on a phone over the LAN — and a
   * browser treats those as three different origins. Pinning one of them means
   * the other two fail with "Failed to fetch", which reads like a network fault
   * rather than a configuration mismatch.
   */
  WEB_ORIGINS: z
    .string()
    .default("http://localhost:3000,http://127.0.0.1:3000")
    .transform((value) =>
      value
        .split(",")
        .map((origin) => origin.trim().replace(/\/+$/, ""))
        .filter(Boolean),
    ),
  DATABASE_URL: z.string().nonempty(),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z
    .string()
    .url()
    .default("http://localhost:3001")
    .transform((url) => url.replace(/\/+$/, "")),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  ZEPTOMAIL_TOKEN: z.string().optional(),
  ZEPTOMAIL_URL: z.string().default("api.zeptomail.com/"),
  ZEPTOMAIL_FROM_ADDRESS: z.string().email().optional(),
  ZEPTOMAIL_FROM_NAME: z.string().default("Nomidat"),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_WEBHOOK_SECRET: z.string().optional(),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_VERIFY_TOKEN: z.string().optional(),
  WHATSAPP_APP_SECRET: z.string().optional(),
  WHATSAPP_TEMPLATE_NAME: z.string().optional(),
  AI_PROVIDER: z.enum(["openai", "gemini"]).default("openai"),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default("gemini-2.5-flash"),
  TRANSCRIPTION_PROVIDER: z.enum(["openai", "deepgram", "whisper"]).default("deepgram"),
  DEEPGRAM_MODEL: z.string().default("nova-3"),
  WHISPER_API_KEY: z.string().optional(),
  WHISPER_MODEL: z.string().default("whisper-1"),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-5-mini"),
  OPENAI_TRANSCRIPTION_MODEL: z.string().default("gpt-4o-mini-transcribe"),
  ENCRYPTION_KEY: z
    .string()
    .regex(/^[a-fA-F0-9]{64}$/)
    .optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default("claude-sonnet-4-6"),
  DEEPGRAM_API_KEY: z.string().optional(),
  PAYSTACK_API_URL: z.string().url().default("https://api.paystack.co"),
  PAYSTACK_CALLBACK_URL: z.string().url().optional(),
  PLATFORM_ADMIN_EMAILS: platformAdminEmails,
  PLATFORM_PAYSTACK_SECRET,
  PLATFORM_PAYSTACK_PUBLIC,
  PLATFORM_DEFAULT_FEE_BPS,
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;

/**
 * A deployment that takes money needs a way to encrypt what it stores, and the
 * only supported way to store a tenant's Paystack secret is to encrypt it.
 * Requiring the key only once the platform is actually configured means local
 * development and CI still boot without one, while a platform that would accept
 * a paying tenant's credentials can no longer start up and discover the gap
 * later — from that tenant, at their first save.
 */
const apiEnv = apiEnvSchema.superRefine((value, ctx) => {
  if (value.PLATFORM_PAYSTACK_SECRET && !value.ENCRYPTION_KEY) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["ENCRYPTION_KEY"],
      message:
        "ENCRYPTION_KEY is required when PLATFORM_PAYSTACK_SECRET is set. Generate one with `openssl rand -hex 32`.",
    });
  }
});

export function parseApiEnv(input: NodeJS.ProcessEnv = process.env): ApiEnv {
  loadEnv();
  return apiEnv.parse(input);
}
