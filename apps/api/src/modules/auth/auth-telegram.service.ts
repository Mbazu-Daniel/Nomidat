import { createHmac, timingSafeEqual } from "node:crypto";
import {
  BadRequestException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { BETTER_AUTH, type BetterAuthInstance } from "../../common/better-auth";
import { API_ENV } from "../../common/config/env.module";
import type { ApiEnv } from "../../common/config/env";

type SignInTelegramMiniAppApi = {
  signInTelegramMiniApp: (input: {
    body: { initData: string };
    headers: Headers;
    asResponse: true;
  }) => Promise<globalThis.Response>;
};

type SignInTelegramWidgetApi = {
  signInTelegramWidget: (input: {
    body: {
      id: string;
      firstName: string;
      lastName?: string;
      username?: string;
      photoUrl?: string;
      authDate: number;
    };
    headers: Headers;
    asResponse: true;
  }) => Promise<globalThis.Response>;
};

/** The fields Telegram's Login Widget posts back. */
export type TelegramLoginPayload = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
};

/**
 * Telegram sign-in from an ordinary web page.
 *
 * The Login Widget is not OAuth. Telegram posts the user's details plus a `hash`
 * derived from the bot token, so the only thing to prove is that the payload came
 * from Telegram and was not assembled by whoever opened the page.
 *
 * The signature here is deliberately different from the Mini App one: the widget
 * keys the HMAC straight off the bot token, while Mini App initData is keyed off
 * a `WebAppData`-derived secret. Reusing the Mini App verifier here would accept
 * nothing the widget sends.
 *
 * Replay is bounded separately: a payload only stays usable for a short window
 * after `auth_date`.
 */
@Injectable()
export class AuthTelegramService {
  private static readonly MAX_AGE_SECONDS = 24 * 60 * 60;

  constructor(
    @Inject(BETTER_AUTH) private readonly betterAuth: BetterAuthInstance,
    @Inject(API_ENV) private readonly env: ApiEnv,
  ) {}

  async createSessionWithTelegramMiniApp(initData: string, headers: Headers) {
    const api = this.betterAuth.api as BetterAuthInstance["api"] & SignInTelegramMiniAppApi;
    if (typeof api.signInTelegramMiniApp !== "function") {
      throw new ServiceUnavailableException(
        "Telegram Mini App sign-in is not configured (set TELEGRAM_BOT_TOKEN)",
      );
    }
    return api.signInTelegramMiniApp({
      body: { initData },
      headers,
      asResponse: true,
    });
  }

  /**
   * Verifies a Login Widget payload, then creates a session for that Telegram
   * user, signing them up on first use. The verified identity is handed to the
   * Better Auth endpoint, which owns session cookies.
   */
  async createSessionWithTelegramLogin(payload: TelegramLoginPayload, headers: Headers) {
    const token = this.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      throw new ServiceUnavailableException("Telegram sign-in is not configured.");
    }
    this.assertFieldsAreAuthentic(payload, token);
    this.assertNotReplayed(payload);

    const api = this.betterAuth.api as BetterAuthInstance["api"] & SignInTelegramWidgetApi;
    if (typeof api.signInTelegramWidget !== "function") {
      throw new ServiceUnavailableException("Telegram sign-in is not configured.");
    }
    return api.signInTelegramWidget({
      body: {
        id: String(payload.id),
        firstName: payload.first_name,
        lastName: payload.last_name,
        username: payload.username,
        photoUrl: payload.photo_url,
        authDate: payload.auth_date,
      },
      headers,
      asResponse: true,
    });
  }

  /**
   * Recomputes the signature over the canonical field string and compares it in
   * constant time. Field order is fixed by Telegram's algorithm, and `hash` is
   * excluded because it is the value being checked.
   */
  private assertFieldsAreAuthentic(payload: TelegramLoginPayload, token: string) {
    const checkString = Object.entries(payload)
      .filter(([key, value]) => key !== "hash" && value !== undefined && value !== "")
      .sort(([left], [right]) => (left < right ? -1 : 1))
      .map(([key, value]) => `${key}=${value}`)
      .join("\n");

    const expected = createHmac("sha256", token).update(checkString).digest("hex");
    const received = payload.hash;
    if (
      typeof received !== "string" ||
      received.length !== expected.length ||
      // A length mismatch is compared separately so timingSafeEqual cannot
      // throw on unequal buffers, which would leak the guess's length.
      !timingSafeEqual(Buffer.from(received), Buffer.from(expected))
    ) {
      throw new BadRequestException("That Telegram login could not be verified.");
    }
  }

  private assertNotReplayed(payload: TelegramLoginPayload) {
    const ageSeconds = Math.floor(Date.now() / 1000) - payload.auth_date;
    if (!Number.isFinite(ageSeconds) || ageSeconds > AuthTelegramService.MAX_AGE_SECONDS) {
      throw new BadRequestException("That Telegram login has expired. Please try again.");
    }
  }
}
