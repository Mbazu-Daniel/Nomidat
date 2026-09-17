import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";

export type Database = PostgresJsDatabase<Record<string, never>>;

export function createDb(connectionString: string): { db: Database; client: postgres.Sql } {
  const client = postgres(connectionString);
  return { db: drizzle(client), client };
}

export * from "./env";
export * from "./schema";
