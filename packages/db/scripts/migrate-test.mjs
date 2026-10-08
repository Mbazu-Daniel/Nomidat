/**
 * Applies the committed migrations to the disposable `_test` database.
 *
 * `DATABASE_URL` always points at development, so without this the test
 * database silently falls behind the schema. The suites then fail on a column
 * added last week, which reads like a product bug rather than a stale database
 * — or, worse, they pass against a schema nobody has actually migrated.
 *
 * Run via `pnpm db:migrate:test`.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

// packages/db/scripts -> repo root. Getting this wrong fails silently: dotenv
// treats a path with no file as an empty environment rather than an error.
const root = resolve(fileURLToPath(new URL(".", import.meta.url)), "../../..");
const envFile = resolve(root, ".env");
if (!existsSync(envFile)) {
  console.error(`No .env at ${envFile}. Copy .env.example to .env first.`);
  process.exit(1);
}
config({ path: envFile, quiet: true });

const url = process.env.TEST_DATABASE_URL;
if (!url) {
  console.error("TEST_DATABASE_URL is not set. Copy it from .env.example into .env.");
  process.exit(1);
}
// The suites check this too and throw, but a clear message here beats a stack
// trace from inside a test file.
if (!new URL(url).pathname.endsWith("_test")) {
  console.error(`TEST_DATABASE_URL must name a database ending in "_test", got "${url}".`);
  process.exit(1);
}

// dotenv never overwrites an already-set key, so the child sees this URL in
// place of the development one.
const result = spawnSync("pnpm", ["--filter", "@nomidat/db", "db:migrate"], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: url },
});

process.exit(result.status ?? 1);
