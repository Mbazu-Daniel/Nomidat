import { Inject, Injectable } from "@nestjs/common";
import { BETTER_AUTH, type BetterAuthInstance } from "../../common/better-auth";
import type {
  GetInvitationQueryDto,
  InvitationIdDto,
  InviteMemberDto,
  ListInvitationsQueryDto,
  ListUserInvitationsQueryDto,
} from "./dto";

@Injectable()
export class InvitationService {
  constructor(
    @Inject(BETTER_AUTH) private readonly betterAuth: BetterAuthInstance,
  ) {}

  async createInvitation(body: InviteMemberDto, headers: Headers) {
    return this.betterAuth.api.createInvitation({
      body: {
        email: body.email,
        role: body.role as "member" | "admin" | "owner" | ("member" | "admin" | "owner")[],
        organizationId: body.organizationId,
        resend: body.resend,
      },
      headers,
      asResponse: true,
    });
  }

  async acceptInvitation(body: InvitationIdDto, headers: Headers) {
    return this.betterAuth.api.acceptInvitation({
      body,
      headers,
      asResponse: true,
    });
  }

  async cancelInvitation(body: InvitationIdDto, headers: Headers) {
    return this.betterAuth.api.cancelInvitation({
      body,
      headers,
      asResponse: true,
    });
  }

  async rejectInvitation(body: InvitationIdDto, headers: Headers) {
    return this.betterAuth.api.rejectInvitation({
      body,
      headers,
      asResponse: true,
    });
  }

  async getInvitation(query: GetInvitationQueryDto, headers: Headers) {
    return this.betterAuth.api.getInvitation({
      query,
      headers,
      asResponse: true,
    });
  }

  async getInvitations(query: ListInvitationsQueryDto, headers: Headers) {
    return this.betterAuth.api.listInvitations({
      query,
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
