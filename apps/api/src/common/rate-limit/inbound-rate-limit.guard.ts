import { CanActivate, ExecutionContext, HttpException, Injectable } from "@nestjs/common";
import type { Request } from "express";

/**
 * Throttles channel webhooks.
 *
 * Buckets are keyed per provider and per tenant, not per IP alone. Behind a
 * reverse proxy every webhook from Telegram arrives from the same handful of
 * addresses, so a single IP-wide counter lets one busy tenant exhaust the whole
 * platform's message quota and lock every other shop out of their own inbox.
 */
@Injectable()
export class InboundRateLimitGuard implements CanActivate {
  /** Messages allowed per provider and tenant per window. */
  private static readonly LIMIT = 120;
  private static readonly WINDOW_MS = 60_000;
  private static readonly MAX_KEYS = 10_000;

  private readonly windows = new Map<string, { count: number; expires: number }>();

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const now = Date.now();
    const key = this.bucketKey(request);
    let window = this.windows.get(key);
    if (!window || window.expires <= now) {
      this.reclaim(now);
      window = { count: 0, expires: now + InboundRateLimitGuard.WINDOW_MS };
      this.windows.set(key, window);
    }
    if (++window.count > InboundRateLimitGuard.LIMIT) {
      throw new HttpException("Too many requests. Please retry in a minute.", 429);
    }
    return true;
  }

  /**
   * The provider from the route, and the tenant from the path when there is one.
   * A webhook that cannot name its tenant falls back to the caller address, which
   * is the only thing left to separate it by.
   */
  private bucketKey(request: Request): string {
    const provider = request.path.split("/").filter(Boolean)[1] ?? "channel";
    const params = request.params as Record<string, string | undefined>;
    const tenant = params.organizationId ?? params.org;
    if (tenant) return `${provider}:${tenant}`;
    const address = request.ip ?? request.socket.remoteAddress ?? "unknown";
    return `${provider}:${address}`;
  }

  /** Drops expired windows so the map cannot grow without bound. */
  private reclaim(now: number) {
    if (this.windows.size < InboundRateLimitGuard.MAX_KEYS) return;
    for (const [key, window] of this.windows) {
      if (window.expires <= now) this.windows.delete(key);
    }
    if (this.windows.size >= InboundRateLimitGuard.MAX_KEYS) {
      throw new HttpException("Server is busy. Please retry shortly.", 429);
    }
  }
}
