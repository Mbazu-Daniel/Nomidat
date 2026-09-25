import { requireMembership } from "../business/organization-membership";
import { Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { BETTER_AUTH } from "../../common/better-auth/better-auth.constants";
import type { BetterAuthInstance } from "../../common/better-auth/create-better-auth";
import { DATABASE, type DbHandle } from "../../common/db/db.provider";

@Injectable()
export class ChannelAuthService {
  constructor(
    @Inject(BETTER_AUTH) private readonly auth: BetterAuthInstance,
    @Inject(DATABASE) private readonly db: DbHandle,
  ) {}

  async getAuthorizedOrganizationUser(
    headers: Headers,
    organizationId: string,
  ): Promise<{ userId: string; organizationId: string }> {
    const session = await this.auth.api.getSession({ headers });
    if (!session?.user?.id) {
      throw new UnauthorizedException("Authentication required");
    }

    await requireMembership(this.db, organizationId, session.user.id);

    return { userId: session.user.id, organizationId };
  }
}
