import { afterEach, expect, it, vi } from "vitest";
import type { ExecutionContext } from "@nestjs/common";
import { InboundRateLimitGuard } from "../inbound-rate-limit.guard";

afterEach(() => vi.useRealTimers());
it("limits an abusive sender while allowing other senders and a new time window", () => {
  vi.useFakeTimers();
  const guard = new InboundRateLimitGuard();
  const sender = (ip: string) =>
    ({ switchToHttp: () => ({ getRequest: () => ({ ip }) }) }) as ExecutionContext;
  for (let count = 0; count < 120; count++) guard.canActivate(sender("one"));
  expect(() => guard.canActivate(sender("one"))).toThrow("Too many requests");
  expect(guard.canActivate(sender("two"))).toBe(true);
  vi.advanceTimersByTime(60001);
  expect(guard.canActivate(sender("one"))).toBe(true);
});
