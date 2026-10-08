import { CanActivate, ExecutionContext, HttpException, Injectable } from "@nestjs/common";
import type { Request } from "express";

/**
 * Throttles the credential-checking routes, which Better Auth's own limiter does
 * not cover.
 *
 * Sign-in here is a thin proxy to Better Auth, so its rate limiting applies to
 * the paths it mounts itself — not to this app's `/auth/*` routes. That left nine
 * of eleven unthrottled, and each password check costs an Argon2id hash at 64 MB.
 *
 * The window is deliberately tight and the budget small: this guards password
 * guessing, which is fast, and it must not make a slow typist wait.
 */
@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  /** Attempts allowed per IP per window. */
  private static readonly LIMIT = 10;
  private static readonly WINDOW_MS = 60_000;
  private static readonly MAX_KEYS = 10_000;

  private readonly windows = new Map<string, { count: number; expires: number }>();

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const now = Date.now();
    const key = request.ip ?? request.socket.remoteAddress ?? "unknown";

    let window = this.windows.get(key);
    if (!window || window.expires <= now) {
      this.reclaim(now);
      window = { count: 0, expires: now + AuthRateLimitGuard.WINDOW_MS };
      this.windows.set(key, window);
    }
    if (++window.count > AuthRateLimitGuard.LIMIT) {
      throw new HttpException("Too many attempts. Please try again in a minute.", 429);
    }
    return true;
  }

  /** Drops expired windows so the map cannot grow without bound. */
  private reclaim(now: number) {
    if (this.windows.size < AuthRateLimitGuard.MAX_KEYS) return;
    for (const [key, window] of this.windows) {
      if (window.expires <= now) this.windows.delete(key);
    }
    if (this.windows.size >= AuthRateLimitGuard.MAX_KEYS) {
      throw new HttpException("Server is busy. Please retry shortly.", 429);
    }
  }
}
