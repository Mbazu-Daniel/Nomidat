import { ForbiddenException } from "@nestjs/common";
import { and, eq } from "@nomidat/db";
import { member } from "@nomidat/db/schema";
import type { DbHandle } from "../../common/db/db.provider";

export async function requireMembership(db: DbHandle, organizationId: string, userId: string) {
  const [membership] = await db.select({ id: member.id, role: member.role })
    .from(member)
    .where(and(eq(member.organizationId, organizationId), eq(member.userId, userId)))
    .limit(1);
  if (!membership) throw new ForbiddenException("Not a member of this organization");
  return membership;
}
