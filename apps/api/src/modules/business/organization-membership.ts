import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { and, eq } from "@nomidat/db";
import { member } from "@nomidat/db/schema";
import type { DbHandle } from "../../common/db/db.provider";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function requireMembership(db: DbHandle, organizationId: string, userId: string) {
  // Checked here because this is where every tenant route passes. Handled by
  // Postgres instead, a malformed id raises an invalid-uuid cast error that the
  // filter reports as 500 — telling a caller the server is broken over a
  // mistyped path segment.
  if (!UUID.test(organizationId)) throw new BadRequestException("Invalid organization id.");

  const [membership] = await db
    .select({ id: member.id, role: member.role })
    .from(member)
    .where(and(eq(member.organizationId, organizationId), eq(member.userId, userId)))
    .limit(1);
  if (!membership) throw new ForbiddenException("Not a member of this organization");
  return membership;
}
