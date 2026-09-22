import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization } from "better-auth/plugins";
import * as schema from "@nomidat/db/schema";
import { generateId } from "@nomidat/db";
import { hashPassword, verifyPassword } from "../helpers/hash-password";
import type { CreateBetterAuthOptions } from "../types/index";
import { telegramMiniApp } from "./plugins/telegram-mini-app.plugin";

const API_VERSION_PATH = "/api/v1";
const AUTH_BASE_PATH = `${API_VERSION_PATH}/auth`;

function resolveGoogleProvider(google: CreateBetterAuthOptions["google"]) {
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

export function createBetterAuth(options: CreateBetterAuthOptions) {
  const socialProviders = resolveGoogleProvider(options.google);
  const useCrossSiteCookies = options.webOrigin.startsWith("https://");

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
      ...(useCrossSiteCookies
        ? {
            defaultCookieAttributes: {
              sameSite: "none" as const,
              secure: true,
            },
          }
        : {}),
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
        trustedProviders: socialProviders ? ["google", "email-password"] : ["email-password"],
      },
    },
    plugins: [
      organization(options.sendInvitationEmail ? { sendInvitationEmail: options.sendInvitationEmail } : {}),
      ...(options.telegramBotToken
        ? [telegramMiniApp({ botToken: options.telegramBotToken })]
        : []),
    ],
  });
}

export type BetterAuthInstance = ReturnType<typeof createBetterAuth>;
