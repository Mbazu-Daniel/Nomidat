import { type Provider } from "@nestjs/common";
import { createDb } from "@nomidat/db";
import { type ApiEnv } from "../config/env";
import { API_ENV } from "../config/env.module";

export const DATABASE = Symbol("DATABASE");
export type DbHandle = ReturnType<typeof createDb>;

/**
 * The handle a transaction callback receives. Derived from the handle itself so it
 * cannot drift when the driver is upgraded, and unioned with DbHandle for
 * repository methods that must work both standalone and inside a caller's
 * transaction.
 */
export type DbTransaction = Parameters<Parameters<DbHandle["transaction"]>[0]>[0];
export type DbExecutor = DbHandle | DbTransaction;

export const dbProvider: Provider = {
  provide: DATABASE,
  inject: [API_ENV],
  useFactory: (env: ApiEnv): DbHandle => createDb(env.DATABASE_URL),
};
