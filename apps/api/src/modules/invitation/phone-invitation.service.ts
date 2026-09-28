import { API_ENV } from "../../common/config/env.module";
import type { ApiEnv } from "../../common/config/env";
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { and, eq, gt, sql } from "@nomidat/db";
import { member, organization, phoneInvitation, user } from "@nomidat/db/schema";
import { DATABASE, type DbHandle } from "../../common/db/db.provider";
import { BETTER_AUTH, type BetterAuthInstance } from "../../common/better-auth";
import { BusinessAuthService } from "../business/business-auth.service";
import type { PhoneInvitationDto } from "./dto/phone-invitation.dto";

@Injectable()
export class PhoneInvitationService {
  constructor(
    @Inject(DATABASE) private readonly db: DbHandle,
    @Inject(BETTER_AUTH) private readonly auth: BetterAuthInstance,
    @Inject(API_ENV) private readonly env: ApiEnv,
    private readonly businessAuth: BusinessAuthService,
  ) {}
  private async manager(headers: Headers, org: string) {
    const actor = await this.businessAuth.getSession(headers, org);
    if (!actor.role.split(",").some((role) => ["owner", "admin"].includes(role)))
      throw new ForbiddenException("Only owners and admins can manage invitations.");
    return actor;
  }
  private async phoneUser(headers: Headers) {
    if (headers.get("origin") && headers.get("origin") !== this.env.WEB_ORIGIN)
      throw new ForbiddenException("Untrusted request origin.");
    const session = await this.auth.api.getSession({ headers });
    if (!session) throw new UnauthorizedException("Sign in with your phone number first.");
    const [person] = await this.db.select().from(user).where(eq(user.id, session.user.id)).limit(1);
    if (!person?.phoneNumber || !person.phoneNumberVerified)
      throw new ForbiddenException("Verify your phone number to access phone invitations.");
    return person;
  }
  async create(headers: Headers, org: string, input: PhoneInvitationDto) {
    const actor = await this.manager(headers, org);
    return this.db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${org + input.phoneNumber}))`);
      const [pending] = await tx
        .select()
        .from(phoneInvitation)
        .where(
          and(
            eq(phoneInvitation.organizationId, org),
            eq(phoneInvitation.phoneNumber, input.phoneNumber),
            eq(phoneInvitation.status, "pending"),
            gt(phoneInvitation.expiresAt, new Date()),
          ),
        )
        .limit(1);
      if (pending)
        throw new BadRequestException(
          "An invitation is already pending for this number. Cancel it before changing permissions.",
        );
      const [created] = await tx
        .insert(phoneInvitation)
        .values({
          organizationId: org,
          phoneNumber: input.phoneNumber,
          role: [...new Set(input.roles)].join(","),
          inviterId: actor.userId,
          expiresAt: new Date(Date.now() + 7 * 86400000),
        })
        .returning();
      return created;
    });
  }
  async list(headers: Headers, org: string) {
    await this.manager(headers, org);
    return this.db
      .select()
      .from(phoneInvitation)
      .where(
        and(
          eq(phoneInvitation.organizationId, org),
          eq(phoneInvitation.status, "pending"),
          gt(phoneInvitation.expiresAt, new Date()),
        ),
      )
      .limit(100);
  }
  async inbox(headers: Headers) {
    const person = await this.phoneUser(headers);
    return this.db
      .select({
        id: phoneInvitation.id,
        organizationId: phoneInvitation.organizationId,
        organizationName: organization.name,
        role: phoneInvitation.role,
        expiresAt: phoneInvitation.expiresAt,
      })
      .from(phoneInvitation)
      .innerJoin(organization, eq(organization.id, phoneInvitation.organizationId))
      .where(
        and(
          eq(phoneInvitation.phoneNumber, person.phoneNumber!),
          eq(phoneInvitation.status, "pending"),
          gt(phoneInvitation.expiresAt, new Date()),
        ),
      )
      .limit(100);
  }
  async cancel(headers: Headers, org: string, id: string) {
    await this.manager(headers, org);
    const [row] = await this.db
      .update(phoneInvitation)
      .set({ status: "cancelled" })
      .where(
        and(
          eq(phoneInvitation.id, id),
          eq(phoneInvitation.organizationId, org),
          eq(phoneInvitation.status, "pending"),
        ),
      )
      .returning();
    if (!row) throw new BadRequestException("Invitation is no longer pending.");
    return { ok: true };
  }
  async respond(headers: Headers, id: string, accept: boolean) {
    const person = await this.phoneUser(headers);
    return this.db.transaction(async (tx) => {
      const [invite] = await tx
        .select()
        .from(phoneInvitation)
        .where(eq(phoneInvitation.id, id))
        .for("update");
      if (!invite || invite.phoneNumber !== person.phoneNumber)
        throw new ForbiddenException("This invitation belongs to another phone number.");
      if (invite.status !== "pending" || invite.expiresAt <= new Date())
        throw new BadRequestException("Invitation has expired or was already handled.");
      if (accept) {
        const [inviter] = await tx
          .select()
          .from(member)
          .where(
            and(
              eq(member.userId, invite.inviterId),
              eq(member.organizationId, invite.organizationId),
            ),
          )
          .limit(1);
        if (!inviter?.role.split(",").some((role) => ["owner", "admin"].includes(role)))
          throw new ForbiddenException(
            "The inviter no longer manages this business. Ask for a new invitation.",
          );
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtext(${invite.organizationId + person.id}))`,
        );
        const [existing] = await tx
          .select()
          .from(member)
          .where(
            and(eq(member.organizationId, invite.organizationId), eq(member.userId, person.id)),
          )
          .limit(1);
        if (!existing)
          await tx
            .insert(member)
            .values({
              organizationId: invite.organizationId,
              userId: person.id,
              role: invite.role,
            });
      }
      await tx
        .update(phoneInvitation)
        .set({ status: accept ? "accepted" : "rejected" })
        .where(eq(phoneInvitation.id, id));
      return { organizationId: invite.organizationId };
    });
  }
}
