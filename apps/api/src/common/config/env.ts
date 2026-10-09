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
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET_NAME: z.string().optional(),
  R2_CUSTOM_DOMAIN: z.string().optional(),
  R2_PUBLIC_ID: z.string().optional(),
});

/** The four values that make an R2 bucket reachable, plus its public hostname. */
const R2_REQUIRED_KEYS = [
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
] as const;

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  /** Absent when the bucket is private, which is a valid setup. */
  publicUrl?: string;
}

/**
 * Works out the public hostname for the bucket.
 *
 * A custom domain wins over the `r2.dev` fallback because it is the one an
 * organization owns: it survives a move between Cloudflare accounts, and it can
 * be put behind a CDN later without changing a single stored key. `r2.dev` is
 * the safety net for a bucket that has not been given a domain yet.
 *
 * Both absent is not an error. A private bucket is a legitimate choice, so the
 * caller gets `undefined` and decides what to do; signing uploads still works.
 */
function resolvePublicUrl(
  customDomain: string | undefined,
  publicId: string | undefined,
): string | undefined {
  const domain = customDomain?.trim();
  if (domain) {
    return domain.startsWith("http://") || domain.startsWith("https://")
      ? domain
      : `https://${domain}`;
  }
  const id = publicId?.trim();
  return id ? `https://pub-${id}.r2.dev` : undefined;
}

/**
 * Collapses the flat R2 variables into one config, or `undefined` when the
 * deployment has no bucket at all.
 *
 * Returning undefined rather than throwing is deliberate: file uploads are one
 * feature among many, so a deployment that has not configured R2 still boots and
 * serves everything else. The feature that needs it fails loudly at the call.
 */
export function getR2Config(env: ApiEnv): R2Config | undefined {
  const values = R2_REQUIRED_KEYS.map((key) => env[key]);
  if (!values.every((value) => Boolean(value?.trim()))) return undefined;

  return {
    accountId: env.R2_ACCOUNT_ID as string,
    accessKeyId: env.R2_ACCESS_KEY_ID as string,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY as string,
    bucketName: env.R2_BUCKET_NAME as string,
    publicUrl: resolvePublicUrl(env.R2_CUSTOM_DOMAIN, env.R2_PUBLIC_ID),
  };
}

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

  // A half-configured bucket is worse than an unconfigured one: it boots, and
  // the first upload fails deep in the S3 client with a credential error rather
  // than a missing-variable error. Refuse the combination instead.
  const configured = R2_REQUIRED_KEYS.filter((key) => Boolean(value[key]?.trim()));
  if (configured.length > 0 && configured.length < R2_REQUIRED_KEYS.length) {
    for (const key of R2_REQUIRED_KEYS) {
      if (configured.includes(key)) continue;
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [key],
        message: `${key} is required because ${configured.join(", ")} is set.`,
      });
    }
  }
});

export function parseApiEnv(input: NodeJS.ProcessEnv = process.env): ApiEnv {
  loadEnv();
  return apiEnv.parse(input);
}
