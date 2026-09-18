import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import * as schema from "@nomidat/db/schema";
import { generateId } from "@nomidat/db";
import { hashPassword, verifyPassword } from "../helpers/hash-password";
import type { CreateAuthOptions } from "../types/index";

export const API_VERSION_PATH = "/api/v1";
export const AUTH_BASE_PATH = `${API_VERSION_PATH}/auth`;

function resolveGoogleProvider(google: CreateAuthOptions["google"]) {
  if (google?.clientId && google.clientSecret) {
    return {
      google: {
        clientId: google.clientId,
        clientSecret: google.clientSecret,
        prompt: "select_account" as const,
        accessType: "offline" as const,
      },
    };
  }
}

export function createAuth(options: CreateAuthOptions) {
  const socialProviders = resolveGoogleProvider(options.google);

  return betterAuth({
    basePath: AUTH_BASE_PATH,
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
