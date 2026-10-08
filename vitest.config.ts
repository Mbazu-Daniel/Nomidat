import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * The money-path suites read TEST_DATABASE_URL at import time, before any hook
 * could run, so the file has to be loaded here rather than in a setup file.
 * Without it every one of those suites skips and `pnpm test` stays green while
 * never touching a database.
 *
 * Absent `.env` — as in the CI unit job, where no database exists — nothing is
 * loaded and the suites skip, which is what that job intends.
 *
 * Existing process.env wins over the file, so a shell override still applies.
 */
const envFile = fileURLToPath(new URL(".env", import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./apps/web/src", import.meta.url)) } },
  test: {
    environment: "node",
    globals: false,
    setupFiles: ["./vitest.setup.ts"],
    include: [
      "apps/api/src/**/test/**/*.spec.ts",
      "apps/web/src/**/test/**/*.spec.ts",
      "packages/db/src/**/test/**/*.spec.ts",
      // End-to-end against a real Postgres. Each suite skips itself unless the
      // environment it needs is set, so the fast gate stays runnable anywhere.
      "apps/api/test/**/*.e2e.ts",
    ],
    coverage: {
      provider: "istanbul",
      reporter: ["json"],
      reportsDirectory: "./coverage",
      include: ["apps/api/src/**/*.ts", "apps/web/src/**/*.{ts,tsx}", "packages/db/src/**/*.ts"],
      exclude: [
        "**/test/**",
        "**/*.spec.ts",
        "**/dist/**",
        "**/*.d.ts",
        "apps/web/src/routeTree.gen.ts",
      ],
    },
  },
});
