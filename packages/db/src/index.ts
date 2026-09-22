import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

export type Database = PostgresJsDatabase<Record<string, never>>;

export type DatabaseClient = Database & { close: () => Promise<void> };\n\nexport function createDb(connectionString: string): DatabaseClient {
  const client = postgres(connectionString);
  const db = drizzle(client);\n  return Object.assign(db, {\n    close: () => client.end({ timeout: 5 }),\n  });
}

export { generateId } from "./id";
export * from "./env";
export * as schema from "./schema";
export { and, count, desc, eq, gte, ilike, isNull, lt, lte, sql, sum } from "drizzle-orm";
