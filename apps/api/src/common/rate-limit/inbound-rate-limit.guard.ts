import { CanActivate, ExecutionContext, HttpException, Injectable } from "@nestjs/common";
import type { Request } from "express";

@Injectable()
export class InboundRateLimitGuard implements CanActivate {
  private readonly windows = new Map<string, { count: number; expires: number }>();

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const now = Date.now();
    const key = request.ip ?? request.socket.remoteAddress ?? "unknown";
    let window = this.windows.get(key);
    if (!window || window.expires <= now) {
      this.ensureCapacity(now);
      window = { count: 0, expires: now + 60000 };
      this.windows.set(key, window);
    }
    if (++window.count > 120)
      throw new HttpException("Too many requests. Please retry in a minute.", 429);
    return true;
  }
  private ensureCapacity(now: number) {
    if (this.windows.size < 10000) return;
    for (const [ip, item] of this.windows) {
      if (item.expires <= now) this.windows.delete(ip);
    }
    if (this.windows.size >= 10000)
      throw new HttpException("Server is busy. Please retry shortly.", 429);
  }
}
