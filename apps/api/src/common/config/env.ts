import { resolve } from "node:path";
import { config } from "dotenv";
import { z } from "zod";

function loadEnv(): void {
  config({ path: resolve(process.cwd(), "../../.env"), quiet: true });
  config({ path: resolve(process.cwd(), ".env"), quiet: true });
}

export const apiEnvSchema = z.object({
  API_PORT: z.coerce.number().int().positive().default(3001),
  WEB_ORIGIN: z.string().url().default("http://localhost:3000"),
  DATABASE_URL: z.string().nonempty(),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z
    .string()
    .url()
    .default("http://localhost:3001")
    .transform((url) => url.replace(/\/+$/, "")),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
});

export type ApiEnv = z.infer<typeof apiEnvSchema>;

export function parseApiEnv(input: NodeJS.ProcessEnv = process.env): ApiEnv {
  loadEnv();
  return apiEnvSchema.parse(input);
}
