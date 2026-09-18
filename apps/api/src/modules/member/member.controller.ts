import { Body, Controller, Get, Post, Query, Req, Res } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request, Response as ExpressResponse } from "express";
import { extractHeaders, proxyAuthResponse } from "../../common/helpers/auth-http";
import { MemberService } from "./member.service";
import {
  AddMemberDto,
  LeaveOrganizationDto,
  ListMembersQueryDto,
  RemoveMemberDto,
  UpdateMemberRoleDto,
} from "./dto";

@ApiTags("Member")
@Controller("organization")
export class MemberController {
  constructor(private readonly memberService: MemberService) {}

  @Get("list-members")
  @ApiOperation({ summary: "Get organization members" })
  async getMembers(
    @Query() query: ListMembersQueryDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: ExpressResponse,
  ) {
    return proxyAuthResponse(
      res,
      await this.memberService.getMembers(query, extractHeaders(req)),
    );
  }

  @Post("remove-member")
  @ApiOperation({ summary: "Remove a member from an organization" })
  async deleteMember(
    @Body() body: RemoveMemberDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: ExpressResponse,
  ) {
    return proxyAuthResponse(
      res,
      await this.memberService.deleteMember(body, extractHeaders(req)),
    );
  }

  @Post("update-member-role")
  @ApiOperation({ summary: "Update a member role" })
  async updateMemberRole(
    @Body() body: UpdateMemberRoleDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: ExpressResponse,
  ) {
    return proxyAuthResponse(
      res,
      await this.memberService.updateMemberRole(body, extractHeaders(req)),
    );
  }

  @Get("get-active-member")
  @ApiOperation({ summary: "Get the current user's membership in the active organization" })
  async getActiveMember(
    @Req() req: Request,
    @Res({ passthrough: true }) res: ExpressResponse,
  ) {
    return proxyAuthResponse(res, await this.memberService.getActiveMember(extractHeaders(req)));
  }

  @Get("get-active-member-role")
  @ApiOperation({ summary: "Get the current user's role in the active organization" })
  async getActiveMemberRole(
    @Req() req: Request,
    @Res({ passthrough: true }) res: ExpressResponse,
  ) {
    return proxyAuthResponse(
      res,
      await this.memberService.getActiveMemberRole(extractHeaders(req)),
    );
  }

  @Post("add-member")
  @ApiOperation({
    summary: "Add a member directly (server-oriented; prefers userId without session)",
  })
  async createMember(
    @Body() body: AddMemberDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: ExpressResponse,
  ) {
    const headers = body.userId ? undefined : extractHeaders(req);
    return proxyAuthResponse(res, await this.memberService.createMember(body, headers));
  }

  @Post("leave")
  @ApiOperation({ summary: "Leave an organization" })
  async deleteMembership(
    @Body() body: LeaveOrganizationDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: ExpressResponse,
  ) {
    return proxyAuthResponse(
      res,
      await this.memberService.deleteMembership(body, extractHeaders(req)),
    );
  }
}
