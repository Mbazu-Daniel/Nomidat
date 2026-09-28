import {
  Body,
  ForbiddenException,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from "@nestjs/common";
import { ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import type { Request, Response as ExpressResponse } from "express";
import { extractHeaders, proxyAuthResponse } from "../../common/helpers/auth-http";
import { BusinessAuthService } from "../business/business-auth.service";
import { MemberService } from "./member.service";
import {
  AddMemberDto,
  ListMembersQueryDto,
  OrganizationMemberParamsDto,
  UpdateMemberRoleDto,
} from "./dto";

@ApiTags("Members")
@Controller()
export class MemberController {
  constructor(
    private readonly memberService: MemberService,
    private readonly auth: BusinessAuthService,
  ) {}

  @Get("organizations/:organizationId/members")
  @ApiOperation({ summary: "Get organization members" })
  @ApiParam({ name: "organizationId", type: "string", format: "uuid" })
  async getOrganizationMembers(
    @Param("organizationId", ParseUUIDPipe) organizationId: string,
    @Query() query: ListMembersQueryDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: ExpressResponse,
  ) {
    return proxyAuthResponse(
      res,
      await this.memberService.getOrganizationMembers(organizationId, query, extractHeaders(req)),
    );
  }

  @Post("organizations/:organizationId/members")
  @ApiOperation({
    summary: "Add a member directly (server-oriented; prefers userId without session)",
  })
  @ApiParam({ name: "organizationId", type: "string", format: "uuid" })
  async createOrganizationMember(
    @Param("organizationId", ParseUUIDPipe) organizationId: string,
    @Body() body: AddMemberDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: ExpressResponse,
  ) {
    const session = await this.auth.getSession(extractHeaders(req), organizationId);
    if (!session.role.split(",").some((role) => ["owner", "admin"].includes(role.trim())))
      throw new ForbiddenException("Only owners and admins can add members.");
    if (
      (Array.isArray(body.role) ? body.role : [body.role]).includes("owner") &&
      !session.role.split(",").includes("owner")
    )
      throw new ForbiddenException("Only owners can create other owners.");
    const headers = body.userId ? undefined : extractHeaders(req);
    return proxyAuthResponse(
      res,
      await this.memberService.createOrganizationMember(organizationId, body, headers),
    );
  }

  @Delete("organizations/:organizationId/members/:memberId")
  @ApiOperation({ summary: "Remove a member from an organization" })
  async deleteOrganizationMember(
    @Param() params: OrganizationMemberParamsDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: ExpressResponse,
  ) {
    return proxyAuthResponse(
      res,
      await this.memberService.deleteOrganizationMember(
        params.organizationId,
        params.memberId,
        extractHeaders(req),
      ),
    );
  }

  @Patch("organizations/:organizationId/members/:memberId")
  @ApiOperation({ summary: "Update a member role" })
  async updateOrganizationMemberRole(
    @Param() params: OrganizationMemberParamsDto,
    @Body() body: UpdateMemberRoleDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: ExpressResponse,
  ) {
    return proxyAuthResponse(
      res,
      await this.memberService.updateOrganizationMemberRole(
        params.organizationId,
        params.memberId,
        body,
        extractHeaders(req),
      ),
    );
  }

  @Post("organizations/:organizationId/leave")
  @ApiOperation({ summary: "Leave an organization" })
  @ApiParam({ name: "organizationId", type: "string", format: "uuid" })
  async leaveOrganization(
    @Param("organizationId", ParseUUIDPipe) organizationId: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: ExpressResponse,
  ) {
    return proxyAuthResponse(
      res,
      await this.memberService.leaveOrganization(organizationId, extractHeaders(req)),
    );
  }

  @Get("members/active")
  @ApiOperation({ summary: "Get the current user's membership in the active organization" })
  async getActiveMember(@Req() req: Request, @Res({ passthrough: true }) res: ExpressResponse) {
    return proxyAuthResponse(res, await this.memberService.getActiveMember(extractHeaders(req)));
  }

  @Get("members/active-role")
  @ApiOperation({ summary: "Get the current user's role in the active organization" })
  async getActiveMemberRole(@Req() req: Request, @Res({ passthrough: true }) res: ExpressResponse) {
    return proxyAuthResponse(
      res,
      await this.memberService.getActiveMemberRole(extractHeaders(req)),
    );
  }
}
