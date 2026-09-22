import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

export type Database = PostgresJsDatabase<Record<string, never>>;

export type DatabaseClient = Database & { close: () => Promise<void> };

export function createDb(connectionString: string): DatabaseClient {
  const client = postgres(connectionString);
  const db = drizzle(client);
  return Object.assign(db, {
    close: () => client.end({ timeout: 5 }),
  });
}

export { generateId } from "./id";
export * from "./env";
export * as schema from "./schema";
export { and, count, desc, eq, gte, ilike, isNull, lt, lte, sql, sum } from "drizzle-orm";
