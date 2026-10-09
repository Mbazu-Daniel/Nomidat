import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { Request, Response as ExpressResponse } from "express";
import { extractHeaders, proxyAuthResponse } from "../../common/helpers/auth-http";
import { AuthRateLimitGuard } from "../../common/rate-limit/auth-rate-limit.guard";
import { OrganizationService } from "./organization.service";
import { OrganizationLogoService } from "./organization-logo.service";
import { BusinessAuthService } from "../business/business-auth.service";
import {
  CheckOrganizationPermissionDto,
  CheckOrganizationSlugDto,
  CreateOrganizationDto,
  GetFullOrganizationQueryDto,
  OrganizationIdParamDto,
  SetActiveOrganizationDto,
  UpdateOrganizationDto,
  UpdateOrganizationLogoDto,
} from "./dto";

@ApiTags("Organizations")
@Controller("organizations")
export class OrganizationController {
  constructor(
    private readonly organizationService: OrganizationService,
    private readonly auth: BusinessAuthService,
    private readonly logos: OrganizationLogoService,
  ) {}

  /**
   * Creating a business writes a row per call, so an unbounded loop here is a
   * way to fill someone's database from one address. The same guard as sign-in:
   * a handful a minute is generous for a human, useless for a script.
   */
  @UseGuards(AuthRateLimitGuard)
  @Post()
  @ApiOperation({ summary: "Create an organization" })
  @ApiResponse({ status: 200, description: "Organization created" })
  async createOrganization(
    @Body() body: CreateOrganizationDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: ExpressResponse,
  ) {
    return proxyAuthResponse(
      res,
      await this.organizationService.createOrganization(body, extractHeaders(req)),
    );
  }

  @UseGuards(AuthRateLimitGuard)
  @Post("check-slug")
  @ApiOperation({ summary: "Check if an organization slug is available" })
  async checkOrganizationSlug(
    @Body() body: CheckOrganizationSlugDto,
    @Res({ passthrough: true }) res: ExpressResponse,
  ) {
    return proxyAuthResponse(res, await this.organizationService.checkOrganizationSlug(body));
  }

  @Get()
  @ApiOperation({ summary: "Get organizations for the current user" })
  async getUserOrganizations(
    @Req() req: Request,
    @Res({ passthrough: true }) res: ExpressResponse,
  ) {
    return proxyAuthResponse(
      res,
      await this.organizationService.getUserOrganizations(extractHeaders(req)),
    );
  }

  @Post("set-active")
  @ApiOperation({ summary: "Set the active organization on the session" })
  async updateActiveOrganization(
    @Body() body: SetActiveOrganizationDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: ExpressResponse,
  ) {
    return proxyAuthResponse(
      res,
      await this.organizationService.updateActiveOrganization(body, extractHeaders(req)),
    );
  }

  @Get(":organizationId")
  @ApiOperation({ summary: "Get organization metadata" })
  async getOrganizationById(
    @Param() params: OrganizationIdParamDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: ExpressResponse,
  ) {
    return proxyAuthResponse(
      res,
      await this.organizationService.getOrganizationById(
        params.organizationId,
        extractHeaders(req),
      ),
    );
  }

  @Get(":organizationId/full")
  @ApiOperation({ summary: "Get full organization details including members" })
  async getFullOrganizationById(
    @Param() params: OrganizationIdParamDto,
    @Query() query: GetFullOrganizationQueryDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: ExpressResponse,
  ) {
    return proxyAuthResponse(
      res,
      await this.organizationService.getFullOrganizationById(
        params.organizationId,
        query,
        extractHeaders(req),
      ),
    );
  }

  @Patch(":organizationId")
  @ApiOperation({ summary: "Update an organization" })
  async updateOrganizationById(
    @Param() params: OrganizationIdParamDto,
    @Body() body: UpdateOrganizationDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: ExpressResponse,
  ) {
    return proxyAuthResponse(
      res,
      await this.organizationService.updateOrganizationById(
        params.organizationId,
        body,
        extractHeaders(req),
      ),
    );
  }

  /**
   * The organization's logo, resolved from the bucket.
   *
   * Separate from `GET /:organizationId` because that one is a pass-through to
   * Better Auth, which does not know about the logo key. Read access is enough:
   * anyone in the business can see the logo, and a storefront can show it without
   * holding a session.
   */
  @Get(":organizationId/logo")
  @ApiOperation({ summary: "Get the organization's logo URL" })
  async getOrganizationLogo(@Param() params: OrganizationIdParamDto) {
    return this.logos.getLogo(params.organizationId);
  }

  @Patch(":organizationId/logo")
  @ApiOperation({ summary: "Set or remove the organization's logo" })
  async updateOrganizationLogo(
    @Param() params: OrganizationIdParamDto,
    @Body() body: UpdateOrganizationLogoDto,
    @Req() req: Request,
  ) {
    // "business" write, not "settings". The area names a permission statement,
    // and `business` is the only one covering the organization's own identity —
    // the logo is what the storefront and every invoice show. Settings is not a
    // statement here at all, so naming it would silently authorize against
    // whatever an unknown area falls back to.
    await this.auth.authorize(
      extractHeaders(req),
      params.organizationId,
      true,
      "business",
    );
    await this.logos.setLogo(params.organizationId, body.logoKey);
    return this.logos.getLogo(params.organizationId);
  }

  @Delete(":organizationId")
  @ApiOperation({ summary: "Delete an organization" })
  async deleteOrganizationById(
    @Param() params: OrganizationIdParamDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: ExpressResponse,
  ) {
    return proxyAuthResponse(
      res,
      await this.organizationService.deleteOrganizationById(
        params.organizationId,
        extractHeaders(req),
      ),
    );
  }

  @Post(":organizationId/has-permission")
  @ApiOperation({ summary: "Check whether the current member has permissions" })
  async checkOrganizationPermission(
    @Param() params: OrganizationIdParamDto,
    @Body() body: CheckOrganizationPermissionDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: ExpressResponse,
  ) {
    return proxyAuthResponse(
      res,
      await this.organizationService.checkOrganizationPermission(
        params.organizationId,
        body,
        extractHeaders(req),
      ),
    );
  }
}
