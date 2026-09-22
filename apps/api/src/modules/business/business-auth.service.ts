import { ForbiddenException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { and, eq } from "@nomidat/db";
import { member } from "@nomidat/db/schema";
import { BETTER_AUTH, type BetterAuthInstance } from "../../common/better-auth";
import { DATABASE, type DbHandle } from "../../common/db/db.provider";

@Injectable()
export class BusinessAuthService {
  constructor(
    @Inject(BETTER_AUTH) private readonly auth: BetterAuthInstance,
    @Inject(DATABASE) private readonly db: DbHandle,
  ) {}

  async getSession(headers: Headers, organizationId: string): Promise<{ userId: string }> {
    const session = await this.auth.api.getSession({ headers });
    if (!session?.user?.id) throw new UnauthorizedException("Authentication required");

    const rows = await this.db.db
      .select({ id: member.id })
      .from(member)
      .where(and(eq(member.organizationId, organizationId), eq(member.userId, session.user.id)))
      .limit(1);

    if (rows.length === 0) throw new ForbiddenException("Not a member of this organization");

    return { userId: session.user.id };
  }

  async authorize(headers: Headers, organizationId: string): Promise<void> {
    await this.getSession(headers, organizationId);
  }
}
