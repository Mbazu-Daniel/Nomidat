import { Inject, Injectable } from "@nestjs/common";
import { BETTER_AUTH, type BetterAuthInstance } from "../../common/better-auth";
import type { AddMemberDto, ListMembersQueryDto, UpdateMemberRoleDto } from "./dto";

@Injectable()
export class MemberService {
  constructor(@Inject(BETTER_AUTH) private readonly betterAuth: BetterAuthInstance) {}

  async getOrganizationMembers(
    organizationId: string,
    query: ListMembersQueryDto,
    headers: Headers,
  ) {
    return this.betterAuth.api.listMembers({
      query: {
        organizationId,
        limit: query.limit,
        offset: query.offset,
        sortBy: query.sortBy,
        sortDirection: query.sortDirection,
        filterField: query.filterField,
        filterOperator: query.filterOperator as
          | "eq"
          | "ne"
          | "lt"
          | "lte"
          | "gt"
          | "gte"
          | "in"
          | "not_in"
          | "contains"
          | "starts_with"
          | "ends_with"
          | undefined,
        filterValue: query.filterValue,
      },
      headers,
      asResponse: true,
    });
  }

  async deleteOrganizationMember(
    organizationId: string,
    memberIdOrEmail: string,
    headers: Headers,
  ) {
    return this.betterAuth.api.removeMember({
      body: { memberIdOrEmail, organizationId },
      headers,
      asResponse: true,
    });
  }

  async updateOrganizationMemberRole(
    organizationId: string,
    memberId: string,
    body: UpdateMemberRoleDto,
    headers: Headers,
  ) {
    return this.betterAuth.api.updateMemberRole({
      body: {
        memberId,
        role: body.role as "member" | "admin" | "owner" | ("member" | "admin" | "owner")[],
        organizationId,
      },
      headers,
      asResponse: true,
    });
  }

  async getActiveMember(headers: Headers) {
    return this.betterAuth.api.getActiveMember({
      headers,
      asResponse: true,
    });
  }

  async getActiveMemberRole(headers: Headers) {
    return this.betterAuth.api.getActiveMemberRole({
      headers,
      asResponse: true,
    });
  }

  async createOrganizationMember(organizationId: string, body: AddMemberDto, headers?: Headers) {
    return this.betterAuth.api.addMember({
      body: {
        userId: body.userId as string,
        role: body.role as "member" | "admin" | "owner" | ("member" | "admin" | "owner")[],
        organizationId,
      },
      ...(headers ? { headers } : {}),
      asResponse: true,
    });
  }

  async leaveOrganization(organizationId: string, headers: Headers) {
    return this.betterAuth.api.leaveOrganization({
      body: { organizationId },
      headers,
      asResponse: true,
    });
  }
}
