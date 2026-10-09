import { Body, Controller, Get, Param, Patch, Req } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { authorizeOrganization } from "../../common/helpers/organization-auth";
import { OrganizationAuthService } from "../organization-summary/organization-auth.service";
import { UpdateStorefrontSettingsDto } from "./dto/storefront-settings.dto";
import { StorefrontSettingsService } from "./storefront-settings.service";

/**
 * Seller-facing shop settings: what is published and how it looks.
 *
 * Gated on the same area as the sibling domain controller, because publishing a
 * shop and claiming its address are the same responsibility — splitting them
 * across two areas would let a role do one and be refused the other.
 */
@ApiTags("Storefront settings")
@Controller("organizations/:organizationId/storefront")
export class StorefrontSettingsController {
  constructor(
    private readonly auth: OrganizationAuthService,
    private readonly settings: StorefrontSettingsService,
  ) {}

  @Get()
  @ApiOperation({ summary: "This shop's publish state, theme and stylesheet" })
  async get(@Param("organizationId") org: string, @Req() req: Request) {
    await authorizeOrganization(this.auth, req, org, "inventory");
    return this.settings.getOverview(org);
  }

  @Patch()
  @ApiOperation({
    summary: "Update shop settings",
    description: "Publishing makes the shop reachable at its slug and any verified domain.",
  })
  async update(
    @Param("organizationId") org: string,
    @Body() body: UpdateStorefrontSettingsDto,
    @Req() req: Request,
  ) {
    await authorizeOrganization(this.auth, req, org, "inventory");
    return this.settings.update(org, body);
  }
}
