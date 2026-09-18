import { Inject, Injectable } from "@nestjs/common";
import { BETTER_AUTH, type BetterAuthInstance } from "../../common/better-auth";
import type {
  CheckOrganizationSlugDto,
  CreateOrganizationDto,
  GetFullOrganizationQueryDto,
  HasPermissionDto,
  SetActiveOrganizationDto,
  UpdateOrganizationDto,
} from "./dto";

@Injectable()
export class OrganizationService {
  constructor(
    @Inject(BETTER_AUTH) private readonly betterAuth: BetterAuthInstance,
  ) {}

  async createOrganization(body: CreateOrganizationDto, headers: Headers) {
    return this.betterAuth.api.createOrganization({
      body,
      headers,
      asResponse: true,
    });
  }

  async checkOrganizationSlug(body: CheckOrganizationSlugDto) {
    return this.betterAuth.api.checkOrganizationSlug({
      body,
      asResponse: true,
    });
  }

  async getOrganizations(headers: Headers) {
    return this.betterAuth.api.listOrganizations({
      headers,
      asResponse: true,
    });
  }

  async updateActiveOrganization(body: SetActiveOrganizationDto, headers: Headers) {
    return this.betterAuth.api.setActiveOrganization({
      body,
      headers,
      asResponse: true,
    });
  }

  async getOrganization(organizationId: string, headers: Headers) {
    return this.betterAuth.api.getOrganization({
      query: { organizationId },
      headers,
      asResponse: true,
    });
  }

  async getFullOrganization(
    organizationId: string,
    query: GetFullOrganizationQueryDto,
    headers: Headers,
  ) {
    return this.betterAuth.api.getFullOrganization({
      query: { organizationId, membersLimit: query.membersLimit },
      headers,
      asResponse: true,
    });
  }

  async updateOrganization(
    organizationId: string,
    body: UpdateOrganizationDto,
    headers: Headers,
  ) {
    return this.betterAuth.api.updateOrganization({
      body: {
        organizationId,
        data: {
          name: body.data.name,
          slug: body.data.slug,
          logo: body.data.logo,
          metadata: body.data.metadata ?? undefined,
        },
      },
      headers,
      asResponse: true,
    });
  }

  async deleteOrganization(organizationId: string, headers: Headers) {
    return this.betterAuth.api.deleteOrganization({
      body: { organizationId },
      headers,
      asResponse: true,
    });
  }

  async getHasPermission(body: HasPermissionDto, headers: Headers) {
    return this.betterAuth.api.hasPermission({
      body,
      headers,
      asResponse: true,
    });
  }
}
