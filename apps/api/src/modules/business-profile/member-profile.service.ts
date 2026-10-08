import { BadRequestException, Inject, Injectable, NotFoundException } from "@nestjs/common";
import { and, eq } from "@nomidat/db";
import { member } from "@nomidat/db/schema";
import { DATABASE, type DbHandle } from "../../common/db/db.provider";
import type { SaveMemberProfileDto } from "./save-member-profile.dto";

/**
 * A person's profile inside one business.
 *
 * Lives on the member rather than the user because the same login can be the
 * owner of one shop and a clerk at another, and each business wants to see its
 * own name and face. Writes are always scoped by both organization and user, so
 * a member of one business can never edit another's row.
 */
@Injectable()
export class MemberProfileService {
  constructor(@Inject(DATABASE) private readonly db: DbHandle) {}

  async getProfile(organizationId: string, userId: string) {
    const [row] = await this.db
      .select({
        firstName: member.firstName,
        lastName: member.lastName,
        avatar: member.avatar,
        role: member.role,
      })
      .from(member)
      .where(and(eq(member.organizationId, organizationId), eq(member.userId, userId)))
      .limit(1);
    if (!row) throw new NotFoundException("You are not a member of this business.");
    return row;
  }

  async saveProfile(organizationId: string, userId: string, input: SaveMemberProfileDto) {
    const firstName = input.firstName.trim();
    if (!firstName) throw new BadRequestException("A first name is required.");

    // Scoped on both columns on purpose: without the userId in the predicate this
    // would update every member of the business.
    const [updated] = await this.db
      .update(member)
      .set({
        firstName,
        lastName: input.lastName?.trim() || null,
        avatar: input.avatar ?? null,
      })
      .where(and(eq(member.organizationId, organizationId), eq(member.userId, userId)))
      .returning({
        firstName: member.firstName,
        lastName: member.lastName,
        avatar: member.avatar,
        role: member.role,
      });
    if (!updated) throw new NotFoundException("You are not a member of this business.");
    return updated;
  }
}
