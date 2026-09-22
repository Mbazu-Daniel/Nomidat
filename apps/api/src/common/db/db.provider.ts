import { type Provider } from "@nestjs/common";
import { createDb } from "@nomidat/db";
import { type ApiEnv } from "../config/env";
import { API_ENV } from "../config/env.module";

export const DATABASE = Symbol("DATABASE");
export type DbHandle = ReturnType<typeof createDb>["db"];

export const dbProvider: Provider = {
  provide: DATABASE,
  inject: [API_ENV],
  useFactory: (env: ApiEnv): DbHandle => createDb(env.DATABASE_URL).db,
};
