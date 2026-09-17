import { Injectable, NestMiddleware } from "@nestjs/common";
import type { Request, Response, NextFunction } from "express";
import { toNodeHandler } from "better-auth/node";
import { AuthService } from "./auth.service";

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  private readonly handler: ReturnType<typeof toNodeHandler>;

  constructor(private readonly authService: AuthService) {
    this.handler = toNodeHandler(this.authService.auth);
  }

  use(req: Request, res: Response, next: NextFunction): void {
    this.handler(req, res);
  }
}
