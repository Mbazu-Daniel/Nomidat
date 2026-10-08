import { ExecutionContext, HttpException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import { AuthRateLimitGuard } from "../src/common/rate-limit/auth-rate-limit.guard";
import { InboundRateLimitGuard } from "../src/common/rate-limit/inbound-rate-limit.guard";

/**
 * Both limiters key on something coarser than the thing being protected.
 *
 * Credential routes are the expensive ones: each attempt is an Argon2id hash at
 * 64 MB, so an unthrottled sign-in is a way to buy server time. Webhooks are the
 * opposite risk — behind a proxy they share an address, so a per-IP counter lets
 * one busy tenant lock out every other shop.
 */

function contextFor(path: string, params: Record<string, string> = {}, ip = "203.0.113.7") {
  return {
    getType: () => "http",
    switchToHttp: () => ({
      getRequest: () => ({ path, params, ip, socket: { remoteAddress: ip } }),
    }),
  } as unknown as ExecutionContext;
}

describe("the auth rate limiter", () => {
  it("refusesAttemptsOnceTheBudgetIsSpent", () => {
    const guard = new AuthRateLimitGuard();

    // Ten attempts a minute is generous for a human and useless for a guesser.
    for (let attempt = 0; attempt < 10; attempt++) {
      expect(guard.canActivate(contextFor("/auth/sign-in/email"))).toBe(true);
    }
    expect(() => guard.canActivate(contextFor("/auth/sign-in/email"))).toThrow(HttpException);
  });

  it("countsEachAddressSeparately", () => {
    const guard = new AuthRateLimitGuard();

    for (let attempt = 0; attempt < 10; attempt++) {
      guard.canActivate(contextFor("/auth/sign-in/email", {}, "198.51.100.1"));
    }
    // One attacker exhausting their budget must not lock out everyone else.
    expect(guard.canActivate(contextFor("/auth/sign-in/email", {}, "198.51.100.2"))).toBe(true);
  });
});

describe("the inbound rate limiter", () => {
  it("refusesMessagesOnceTheBudgetIsSpent", () => {
    const guard = new InboundRateLimitGuard();

    for (let attempt = 0; attempt < 120; attempt++) {
      expect(guard.canActivate(contextFor("/channels/telegram/webhook"))).toBe(true);
    }
    expect(() => guard.canActivate(contextFor("/channels/telegram/webhook"))).toThrow(
      HttpException,
    );
  });

  it("keepsOneShopFromExhaustingAnotherShopsQuota", () => {
    const guard = new InboundRateLimitGuard();
    const busy = { organizationId: "11111111-1111-1111-1111-111111111111" };
    const quiet = { organizationId: "22222222-2222-2222-2222-222222222222" };

    for (let message = 0; message < 120; message++) {
      guard.canActivate(contextFor("/channels/telegram/webhook", busy));
    }

    // The failing case this fixes: every webhook arrives from the same few
    // addresses, so a shared bucket would 429 the whole platform.
    expect(guard.canActivate(contextFor("/channels/telegram/webhook", quiet))).toBe(true);
  });

  it("countsEachProviderSeparately", () => {
    const guard = new InboundRateLimitGuard();
    const tenant = { organizationId: "33333333-3333-3333-3333-333333333333" };

    for (let message = 0; message < 120; message++) {
      guard.canActivate(contextFor("/channels/telegram/webhook", tenant));
    }

    // WhatsApp traffic is unrelated to a Telegram flood.
    expect(guard.canActivate(contextFor("/channels/whatsapp/webhook", tenant))).toBe(true);
  });

  it("fallsBackToTheCallerAddress_whenTheWebhookNamesNoTenant", () => {
    const guard = new InboundRateLimitGuard();

    // The path is the only thing available at this point, so the provider still
    // keeps the buckets apart.
    expect(guard.canActivate(contextFor("/channels/telegram/webhook"))).toBe(true);
    expect(guard.canActivate(contextFor("/channels/whatsapp/webhook"))).toBe(true);
  });
});
