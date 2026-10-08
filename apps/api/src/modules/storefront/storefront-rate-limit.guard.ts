import type { Request } from "express";
import { CanActivate, ExecutionContext, HttpException, Injectable } from "@nestjs/common";
/**
 * Rate limits for the public storefront. A shop has no authenticated users, so
 * this is the only thing standing between the internet and unbounded writes.
 * Reads are generous; anything that creates an order is strict.
 */
@Injectable()
export class StorefrontRateLimitGuard implements CanActivate {
  private readonly windows = new Map<string, { count: number; expires: number }>();

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const isWrite = request.method !== "GET";
    const limit = isWrite ? 10 : 120;
    const windowMs = 60_000;

    const now = Date.now();
    const key = `${isWrite ? "w" : "r"}:${request.ip ?? "unknown"}`;
    const window = this.currentWindow(key, now, windowMs);

    if (++window.count > limit) {
      throw new HttpException("Too many requests. Please retry in a minute.", 429);
    }
    return true;
  }

  private currentWindow(key: string, now: number, windowMs: number) {
    const existing = this.windows.get(key);
    if (existing && existing.expires > now) return existing;

    this.evictExpired(now);
    const fresh = { count: 0, expires: now + windowMs };
    this.windows.set(key, fresh);
    return fresh;
  }

  /** Keeps the map bounded; an unbounded map is itself a memory leak. */
  private evictExpired(now: number) {
    if (this.windows.size < 10_000) return;
    for (const [key, window] of this.windows) {
      if (window.expires <= now) this.windows.delete(key);
    }
  }
}
