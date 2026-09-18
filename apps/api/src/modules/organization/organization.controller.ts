import { Body, Controller, Get, Param, Post, Query, Req, Res } from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import type { Request, Response as ExpressResponse } from "express";
import { extractHeaders, proxyAuthResponse } from "../../common/helpers/auth-http";
import { OrganizationService } from "./organization.service";
import {
  CheckOrganizationSlugDto,
  CreateOrganizationDto,
  GetFullOrganizationQueryDto,
  HasPermissionDto,
  OrganizationIdParamDto,
  SetActiveOrganizationDto,
  UpdateOrganizationDto,
} from "./dto";

@ApiTags("Organization")
@Controller("organization")
export class OrganizationController {
  constructor(private readonly organizationService: OrganizationService) {}

  @Post("create")
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

  @Post("check-slug")
  @ApiOperation({ summary: "Check if an organization slug is available" })
  async checkOrganizationSlug(
    @Body() body: CheckOrganizationSlugDto,
    @Res({ passthrough: true }) res: ExpressResponse,
  ) {
    return proxyAuthResponse(res, await this.organizationService.checkOrganizationSlug(body));
  }

  @Get("list")
  @ApiOperation({ summary: "Get organizations for the current user" })
  async getOrganizations(
    @Req() req: Request,
    @Res({ passthrough: true }) res: ExpressResponse,
  ) {
    return proxyAuthResponse(
      res,
      await this.organizationService.getOrganizations(extractHeaders(req)),
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
  async getOrganization(
    @Param() params: OrganizationIdParamDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: ExpressResponse,
  ) {
    return proxyAuthResponse(
      res,
      await this.organizationService.getOrganization(params.organizationId, extractHeaders(req)),
    );
  }

  @Get(":organizationId/full")
  @ApiOperation({ summary: "Get full organization details including members" })
  async getFullOrganization(
    @Param() params: OrganizationIdParamDto,
    @Query() query: GetFullOrganizationQueryDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: ExpressResponse,
  ) {
    return proxyAuthResponse(
      res,
      await this.organizationService.getFullOrganization(
        params.organizationId,
        query,
        extractHeaders(req),
      ),
    );
  }

  @Post(":organizationId/update")
  @ApiOperation({ summary: "Update an organization" })
  async updateOrganization(
    @Param() params: OrganizationIdParamDto,
    @Body() body: UpdateOrganizationDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: ExpressResponse,
  ) {
    return proxyAuthResponse(
      res,
      await this.organizationService.updateOrganization(
        params.organizationId,
        body,
        extractHeaders(req),
      ),
    );
  }

  @Post(":organizationId/delete")
  @ApiOperation({ summary: "Delete an organization" })
  async deleteOrganization(
    @Param() params: OrganizationIdParamDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: ExpressResponse,
  ) {
    return proxyAuthResponse(
      res,
      await this.organizationService.deleteOrganization(params.organizationId, extractHeaders(req)),
    );
  }

  @Post("has-permission")
  @ApiOperation({ summary: "Check whether the current member has permissions" })
  async getHasPermission(
    @Body() body: HasPermissionDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: ExpressResponse,
  ) {
    return proxyAuthResponse(
      res,
      await this.organizationService.getHasPermission(body, extractHeaders(req)),
    );
  }
}
