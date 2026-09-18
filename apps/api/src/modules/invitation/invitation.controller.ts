import { Body, Controller, Get, Post, Query, Req, Res } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request, Response as ExpressResponse } from "express";
import { extractHeaders, proxyAuthResponse } from "../../common/helpers/auth-http";
import { InvitationService } from "./invitation.service";
import {
  GetInvitationQueryDto,
  InvitationIdDto,
  InviteMemberDto,
  ListInvitationsQueryDto,
  ListUserInvitationsQueryDto,
} from "./dto";

@ApiTags("Invitation")
@Controller("organization")
export class InvitationController {
  constructor(private readonly invitationService: InvitationService) {}

  @Post("invite-member")
  @ApiOperation({ summary: "Invite a member to an organization" })
  async createInvitation(
    @Body() body: InviteMemberDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: ExpressResponse,
  ) {
    return proxyAuthResponse(
      res,
      await this.invitationService.createInvitation(body, extractHeaders(req)),
    );
  }

  @Post("accept-invitation")
  @ApiOperation({ summary: "Accept an organization invitation" })
  async acceptInvitation(
    @Body() body: InvitationIdDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: ExpressResponse,
  ) {
    return proxyAuthResponse(
      res,
      await this.invitationService.acceptInvitation(body, extractHeaders(req)),
    );
  }

  @Post("cancel-invitation")
  @ApiOperation({ summary: "Cancel a pending invitation" })
  async cancelInvitation(
    @Body() body: InvitationIdDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: ExpressResponse,
  ) {
    return proxyAuthResponse(
      res,
      await this.invitationService.cancelInvitation(body, extractHeaders(req)),
    );
  }

  @Post("reject-invitation")
  @ApiOperation({ summary: "Reject an organization invitation" })
  async rejectInvitation(
    @Body() body: InvitationIdDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: ExpressResponse,
  ) {
    return proxyAuthResponse(
      res,
      await this.invitationService.rejectInvitation(body, extractHeaders(req)),
    );
  }

  @Get("get-invitation")
  @ApiOperation({ summary: "Get an invitation by id" })
  async getInvitation(
    @Query() query: GetInvitationQueryDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: ExpressResponse,
  ) {
    return proxyAuthResponse(
      res,
      await this.invitationService.getInvitation(query, extractHeaders(req)),
    );
  }

  @Get("list-invitations")
  @ApiOperation({ summary: "Get invitations for an organization" })
  async getInvitations(
    @Query() query: ListInvitationsQueryDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: ExpressResponse,
  ) {
    return proxyAuthResponse(
      res,
      await this.invitationService.getInvitations(query, extractHeaders(req)),
    );
  }

  @Get("list-user-invitations")
  @ApiOperation({ summary: "Get invitations for the current user (or email on server)" })
  async getUserInvitations(
    @Query() query: ListUserInvitationsQueryDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: ExpressResponse,
  ) {
    return proxyAuthResponse(
      res,
      await this.invitationService.getUserInvitations(query, extractHeaders(req)),
    );
  }
}
