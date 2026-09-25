import { ForbiddenException, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { API_ENV } from "../../common/config/env.module";
import type { ApiEnv } from "../../common/config/env";
import { and, eq } from "@nomidat/db";
import { member } from "@nomidat/db/schema";
import { BETTER_AUTH, type BetterAuthInstance } from "../../common/better-auth";
import { DATABASE, type DbHandle } from "../../common/db/db.provider";

@Injectable()
export class BusinessAuthService {
  constructor(
    @Inject(BETTER_AUTH) private readonly auth: BetterAuthInstance,
    @Inject(DATABASE) private readonly db: DbHandle,
    @Inject(API_ENV) private readonly env: ApiEnv,
  ) {}

  async getSession(
    headers: Headers,
    organizationId: string,
  ): Promise<{ userId: string; role: string }> {
    const origin = headers.get("origin");
    if (origin && origin !== this.env.WEB_ORIGIN)
      throw new ForbiddenException("Untrusted request origin.");
    const session = await this.auth.api.getSession({ headers });
    if (!session?.user?.id) throw new UnauthorizedException("Authentication required");

    const rows = await this.db
      .select({ id: member.id, role: member.role })
      .from(member)
      .where(and(eq(member.organizationId, organizationId), eq(member.userId, session.user.id)))
      .limit(1);

    if (rows.length === 0) throw new ForbiddenException("Not a member of this organization");

    return { userId: session.user.id, role: rows[0].role };
  }

  authorizeWrite(role: string, area?: string): void {
    if (
      !role
        .split(",")
        .some(
          (value) =>
            ["owner", "admin", "manager"].includes(value.trim()) ||
            (area
              ? value.trim() === area + "_writer"
              : [
                  "inventory_writer",
                  "sales_writer",
                  "expenses_writer",
                  "invoices_writer",
                  "customers_writer",
                  "channels_writer",
                ].includes(value.trim())),
        )
    ) {
      throw new ForbiddenException("You do not have permission to change these business records.");
    }
  }

  async authorize(
    headers: Headers,
    organizationId: string,
    write = false,
    area?: string,
  ): Promise<void> {
    const session = await this.getSession(headers, organizationId);
    if (write) this.authorizeWrite(session.role, area);
  }
}
