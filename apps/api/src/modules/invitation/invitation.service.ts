import { Inject, Injectable } from "@nestjs/common";
import { BETTER_AUTH, type BetterAuthInstance } from "../../common/better-auth";
import type { InviteMemberDto, ListUserInvitationsQueryDto } from "./dto";

@Injectable()
export class InvitationService {
  constructor(@Inject(BETTER_AUTH) private readonly betterAuth: BetterAuthInstance) {}

  async createOrganizationInvitation(
    organizationId: string,
    body: InviteMemberDto,
    headers: Headers,
  ) {
    return this.betterAuth.api.createInvitation({
      body: {
        email: body.email,
        role: body.role as "member" | "admin" | "owner" | ("member" | "admin" | "owner")[],
        organizationId,
        resend: body.resend,
      },
      headers,
      asResponse: true,
    });
  }

  async acceptInvitationById(invitationId: string, headers: Headers) {
    return this.betterAuth.api.acceptInvitation({
      body: { invitationId },
      headers,
      asResponse: true,
    });
  }

  async cancelInvitationById(invitationId: string, headers: Headers) {
    return this.betterAuth.api.cancelInvitation({
      body: { invitationId },
      headers,
      asResponse: true,
    });
  }

  async rejectInvitationById(invitationId: string, headers: Headers) {
    return this.betterAuth.api.rejectInvitation({
      body: { invitationId },
      headers,
      asResponse: true,
    });
  }

  async getInvitationById(invitationId: string, headers: Headers) {
    return this.betterAuth.api.getInvitation({
      query: { id: invitationId },
      headers,
      asResponse: true,
    });
  }

  async getOrganizationInvitations(organizationId: string, headers: Headers) {
    return this.betterAuth.api.listInvitations({
      query: { organizationId },
      headers,
      asResponse: true,
    });
  }

  async getUserInvitations(query: ListUserInvitationsQueryDto, headers: Headers) {
    return this.betterAuth.api.listUserInvitations({
      query,
      headers,
      asResponse: true,
    });
  }
}
