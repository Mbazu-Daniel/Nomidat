import { Body, Controller, Get, Param, Post, Req } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { extractHeaders } from "../../common/helpers/auth-http";
import { OrganizationAuthService } from "../organization-summary/organization-auth.service";
import { SaveMemberProfileDto } from "./save-member-profile.dto";
import { MemberProfileService } from "./member-profile.service";

@ApiTags("Member profile")
@Controller("organizations/:organizationId/business-profile")
export class MemberProfileController {
  constructor(
    private readonly auth: OrganizationAuthService,
    private readonly members: MemberProfileService,
  ) {}

  @Get("member")
  @ApiOperation({ summary: "Get the signed-in member's profile in this business" })
  async getMemberProfile(
    @Param("organizationId") org: string,
    @Req() req: Request,
  ): Promise<unknown> {
    const session = await this.auth.getSession(extractHeaders(req), org);
    return this.members.getProfile(org, session.userId);
  }

  @Post("member")
  @ApiOperation({ summary: "Set the signed-in member's profile in this business" })
  async saveMemberProfile(
    @Param("organizationId") org: string,
    @Req() req: Request,
    @Body() body: SaveMemberProfileDto,
  ): Promise<unknown> {
    const session = await this.auth.getSession(extractHeaders(req), org);
    return this.members.saveProfile(org, session.userId, body);
  }
}
