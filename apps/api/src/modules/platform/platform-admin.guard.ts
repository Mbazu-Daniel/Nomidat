import { ForbiddenException, Inject, Injectable } from "@nestjs/common";
import { API_ENV } from "../../common/config/env.module";
import type { ApiEnv } from "../../common/config/env";

/** Cross-tenant routes need this; being an owner of your own business is not enough. */
@Injectable()
export class PlatformAdminGuard {
  constructor(@Inject(API_ENV) private readonly env: ApiEnv) {}

  isPlatformAdmin(email: string | null | undefined): boolean {
    if (!email) return false;
    // Normalised on both sides so a hand-edited env value cannot silently fail to match.
    const candidate = email.trim().toLowerCase();
    return this.env.PLATFORM_ADMIN_EMAILS.some(
      (allowed) => allowed.trim().toLowerCase() === candidate,
    );
  }

  assertPlatformAdmin(email: string | null | undefined): void {
    if (!this.isPlatformAdmin(email)) {
      // Same answer signed out as in, so this cannot confirm which emails exist.
      throw new ForbiddenException("Platform administrator access required.");
    }
  }
}
