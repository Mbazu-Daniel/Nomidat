import { Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { BETTER_AUTH, type BetterAuthInstance } from "../../common/better-auth";

type SignInTelegramMiniAppApi = {
  signInTelegramMiniApp: (input: {
    body: { initData: string };
    headers: Headers;
    asResponse: true;
  }) => Promise<globalThis.Response>;
};

@Injectable()
export class AuthTelegramService {
  constructor(
    @Inject(BETTER_AUTH) private readonly betterAuth: BetterAuthInstance,
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
}
