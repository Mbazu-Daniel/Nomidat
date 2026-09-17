import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { uuidv7 } from "uuidv7";

export type Database = PostgresJsDatabase<Record<string, never>>;

export function createDb(connectionString: string): { db: Database; client: postgres.Sql } {
  const client = postgres(connectionString);
  return { db: drizzle(client), client };
}

export function generateId(): string {
  return uuidv7();
}

export * from "./env";
export * as schema from "./auth";
