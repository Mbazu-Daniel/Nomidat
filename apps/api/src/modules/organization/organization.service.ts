import { Inject, Injectable } from "@nestjs/common";
import { BETTER_AUTH, type BetterAuthInstance } from "../../common/better-auth";
import type {
  CheckOrganizationPermissionDto,
  CheckOrganizationSlugDto,
  CreateOrganizationDto,
  GetFullOrganizationQueryDto,
  SetActiveOrganizationDto,
  UpdateOrganizationDto,
} from "./dto";

@Injectable()
export class OrganizationService {
  constructor(@Inject(BETTER_AUTH) private readonly betterAuth: BetterAuthInstance) {}

  async createOrganization(body: CreateOrganizationDto, headers: Headers) {
    return this.betterAuth.api.createOrganization({
      body: {
        ...body,
        metadata: body.businessDetails
          ? { ...body.metadata, businessDetails: body.businessDetails }
          : body.metadata,
      },
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

  async getUserOrganizations(headers: Headers) {
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

  async getOrganizationById(organizationId: string, headers: Headers) {
    return this.betterAuth.api.getOrganization({
      query: { organizationId },
      headers,
      asResponse: true,
    });
  }

  async getFullOrganizationById(
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

  async updateOrganizationById(
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

  async deleteOrganizationById(organizationId: string, headers: Headers) {
    return this.betterAuth.api.deleteOrganization({
      body: { organizationId },
      headers,
      asResponse: true,
    });
  }

  async checkOrganizationPermission(
    organizationId: string,
    body: CheckOrganizationPermissionDto,
    headers: Headers,
  ) {
    return this.betterAuth.api.hasPermission({
      body: { ...body, organizationId },
      headers,
      asResponse: true,
    });
  }
}
