/**
 * Applies every migration in journal order against a throwaway database and
 * reports the first failure. Migrations are hand-written here, so they need to
 * be proven against a real Postgres rather than assumed to be valid SQL.
 *
 * Usage: node packages/db/scripts/verify-migrations.mjs <connectionString>
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import postgres from "postgres";

const here = dirname(fileURLToPath(import.meta.url));
const migrationsDir = resolve(here, "../drizzle");

// Without this the script silently falls through to the hardcoded 5432 below
// and reports ECONNREFUSED against a database that is running on another port.
config({ path: resolve(here, "../../../.env"), quiet: true });

const connectionString =
  process.argv[2] ??
  process.env.DATABASE_URL ??
  "postgresql://postgres:postgres@localhost:5432/postgres";

const journal = JSON.parse(readFileSync(resolve(migrationsDir, "meta/_journal.json"), "utf8"));

const sql = postgres(connectionString, { max: 1, onnotice: () => {} });

try {
  const [{ max: version }] =
    await sql`select setting::int as max from pg_settings where name='server_version_num'`;
  // server_version_num is an integer like 160004; major is the first two digits
  // for 10+, so a fixed divisor is only correct for modern servers.
  const major = Math.floor(version / 10_000);
  console.log(`connected: server ${major}.${String(version).slice(2, 4)} (version_num ${version})`);

  // A scratch schema keeps a real database untouched.
  const schema = "migration_check";
  await sql.unsafe(`drop schema if exists ${schema} cascade`);
  await sql.unsafe(`create schema ${schema}`);
  await sql.unsafe(`set search_path to ${schema}`);

  for (const entry of journal.entries) {
    const file = resolve(migrationsDir, `${entry.tag}.sql`);
    const body = readFileSync(file, "utf8");

    // Statement breakpoints are drizzle's separator, not SQL.
    const statements = body
      .split("--> statement-breakpoint")
      .map((statement) => statement.trim())
      .filter(Boolean);

    try {
      await sql.begin(async (tx) => {
        for (const [index, statement] of statements.entries()) {
          try {
            await tx.unsafe(statement);
          } catch (statementError) {
            // Naming the statement turns "something in a 139-line file is wrong"
            // into a single line to look at. Aborts the surrounding transaction.
            const preview = statement.replace(/\s+/g, " ").slice(0, 160);
            const wrapped = new Error(
              `statement ${index + 1} of ${statements.length} failed: ${statementError.message}\n    ${preview}`,
            );
            wrapped.cause = statementError;
            throw wrapped;
          }
        }
      });
      console.log(`  ok  ${entry.tag} (${statements.length} statements)`);
    } catch (error) {
      console.error(`FAIL  ${entry.tag}: ${error.message}`);
      process.exitCode = 1;
      break;
    }
  }

  if (!process.exitCode) {
    const tables = await sql.unsafe(
      `select count(*)::int as count from information_schema.tables where table_schema = '${schema}'`,
    );
    console.log(
      `\nall ${journal.entries.length} migrations applied; ${tables[0].count} tables created`,
    );
  }
} catch (error) {
  console.error(`could not verify: ${error.message}`);
  process.exitCode = 1;
} finally {
  await sql.end();
}
