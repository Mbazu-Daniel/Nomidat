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
import {
  CheckOrganizationPermissionDto,
  CheckOrganizationSlugDto,
  CreateOrganizationDto,
  GetFullOrganizationQueryDto,
  OrganizationIdParamDto,
  SetActiveOrganizationDto,
  UpdateOrganizationDto,
} from "./dto";

@ApiTags("Organizations")
@Controller("organizations")
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

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
