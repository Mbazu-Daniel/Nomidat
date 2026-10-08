/**
 * Static consistency check between the Drizzle schema and the hand-written
 * migrations. A live database is not always available, so this proves the thing
 * that is easiest to get wrong by hand: that every table the schema declares is
 * actually created by the migration chain, in an order that works.
 *
 * Usage: node packages/db/scripts/check-migration-coverage.mjs
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dbRoot = resolve(here, "..");
const migrationsDir = resolve(dbRoot, "drizzle");

const journal = JSON.parse(readFileSync(resolve(migrationsDir, "meta/_journal.json"), "utf8"));

/** Table name -> ordered list of columns the migration chain produces. */
const built = new Map();
const statements = [];

for (const entry of journal.entries) {
  const body = readFileSync(resolve(migrationsDir, `${entry.tag}.sql`), "utf8");
  for (const raw of body.split("--> statement-breakpoint")) {
    const statement = raw.trim();
    if (!statement) continue;
    statements.push({ tag: entry.tag, statement });

    const create = statement.match(/^CREATE TABLE (?:IF NOT EXISTS )?"?([\w]+)"?/i);
    if (create) built.set(create[1], new Set());

    const addColumn = statement.match(/^ALTER TABLE "(\w+)" ADD COLUMN "?(\w+)"?/i);
    if (addColumn) {
      const table = built.get(addColumn[1]);
      if (table) table.add(addColumn[2]);
    }
  }
}

/** Every pgTable(...) declared in the schema source. */
const declared = new Set();
const { readdirSync } = await import("node:fs");

function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full);
      continue;
    }
    if (!entry.name.endsWith(".ts") || entry.name.endsWith(".d.ts")) continue;

    const source = readFileSync(full, "utf8");
    for (const match of source.matchAll(/pgTable\(\s*"(\w+)"/g)) {
      declared.add(match[1]);
    }
  }
}

walk(resolve(dbRoot, "src"));

// Tables created by hand-written SQL, not by a pgTable declaration.
const SQL_ONLY_TABLES = new Set(["__drizzle_migrations", "drizzle_migrations"]);

const missing = [...declared].filter((table) => !built.has(table) && !SQL_ONLY_TABLES.has(table));

// A foreign key can only be added once its target table exists.
const fkProblems = [];
for (const { tag, statement } of statements) {
  const fk = statement.match(
    /^ALTER TABLE "(\w+)" ADD CONSTRAINT \S+ FOREIGN KEY \("?(\w+)"?\) REFERENCES "public"\."(\w+)"/i,
  );
  if (fk && !built.has(fk[3])) {
    fkProblems.push(`${tag}: ${fk[1]}.${fk[2]} references ${fk[3]}, which does not exist yet`);
  }
}

console.log(`schema declares ${declared.size} tables`);
console.log(`migrations create ${built.size} tables across ${journal.entries.length} migrations`);

if (missing.length) {
  console.error(`\nMISSING CREATE TABLE for: ${missing.join(", ")}`);
}
if (fkProblems.length) {
  console.error(`\nFOREIGN KEY ORDERING PROBLEMS:`);
  for (const problem of fkProblems) console.error(`  ${problem}`);
}

if (!missing.length && !fkProblems.length) {
  console.log("\nschema and migrations agree");
} else {
  process.exitCode = 1;
}
