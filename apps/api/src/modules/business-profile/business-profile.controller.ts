import { Body, Controller, Get, Param, Post, Req } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { extractHeaders } from "../../common/helpers/auth-http";
import { BusinessAuthService } from "../business/business-auth.service";
import { BusinessProfileService } from "./business-profile.service";
import { MemberProfileService } from "./member-profile.service";
import { SaveMemberProfileDto } from "./save-member-profile.dto";

@ApiTags("Business profile")
@Controller("organizations/:organizationId/business-profile")
export class BusinessProfileController {
  constructor(
    private readonly auth: BusinessAuthService,
    private readonly profiles: BusinessProfileService,
    private readonly members: MemberProfileService,
  ) {}

  @Get()
  @ApiOperation({ summary: "Get business profile status" })
  async getStatus(@Param("organizationId") org: string, @Req() req: Request) {
    await this.auth.authorize(extractHeaders(req), org);
    return this.profiles.getStatus(org);
  }

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
