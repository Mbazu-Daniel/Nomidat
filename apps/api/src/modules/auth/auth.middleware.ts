import { Inject, Injectable, NestMiddleware } from "@nestjs/common";
import type { Request, Response, NextFunction } from "express";
import { toNodeHandler } from "better-auth/node";
import { BETTER_AUTH, type BetterAuthInstance } from "../../common/better-auth";

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  private readonly handler: ReturnType<typeof toNodeHandler>;

  constructor(@Inject(BETTER_AUTH) betterAuth: BetterAuthInstance) {
    this.handler = toNodeHandler(betterAuth);
  }

  use(req: Request, res: Response, _next: NextFunction): void {
    this.handler(req, res);
  }
}
