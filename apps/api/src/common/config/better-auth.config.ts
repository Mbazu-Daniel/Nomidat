import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import * as schema from "@nomidat/db/schema";
import { generateId } from "@nomidat/db";
import type { Database } from "@nomidat/db";
import { hashPassword, verifyPassword } from "../helpers/hash-password";
import type { CreateAuthOptions } from "../types/index";

export const API_VERSION_PATH = "/api/v1";

export function createAuth(options: CreateAuthOptions) {
  const socialProviders =
    options.google &&
    options.google.clientId &&
    options.google.clientSecret
      ? {
          google: {
            clientId: options.google.clientId,
            clientSecret: options.google.clientSecret,
          },
        }
      : undefined;

  return betterAuth({
    basePath: `${API_VERSION_PATH}/auth`,
    database: drizzleAdapter(options.db, {
      provider: "pg",
      schema,
    }),
    secret: options.secret,
    baseURL: options.baseURL,
    trustedOrigins: [options.webOrigin],
    advanced: {
      database: {
        generateId,
      },
    },
    emailAndPassword: {
      enabled: true,
      password: {
        hash: hashPassword,
        verify: verifyPassword,
      },
    },
    socialProviders,
    account: {
      accountLinking: {
        enabled: true,
        trustedProviders: socialProviders
          ? ["google", "email-password"]
          : ["email-password"],
      },
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
