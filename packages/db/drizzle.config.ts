import { resolve } from "node:path";
import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";
import { parseDatabaseEnv } from "./src/env";

config({ path: resolve(__dirname, "../../.env") });

const env = parseDatabaseEnv(process.env);

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/auth/index.ts",
  out: "./drizzle",
  dbCredentials: {
    url: env.DATABASE_URL,
  },
});
