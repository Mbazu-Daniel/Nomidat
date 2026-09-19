import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req, Res } from "@nestjs/common";
import { ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import type { Request, Response as ExpressResponse } from "express";
import { extractHeaders, proxyAuthResponse } from "../../common/helpers/auth-http";
import { InvitationService } from "./invitation.service";
import { InvitationIdDto, InviteMemberDto, ListUserInvitationsQueryDto } from "./dto";

@ApiTags("Invitations")
@Controller()
export class InvitationController {
  constructor(private readonly invitationService: InvitationService) {}

  @Post("organizations/:organizationId/invitations")
  @ApiOperation({ summary: "Invite a member to an organization" })
  @ApiParam({ name: "organizationId", type: "string", format: "uuid" })
  async createOrganizationInvitation(
    @Param("organizationId", ParseUUIDPipe) organizationId: string,
    @Body() body: InviteMemberDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: ExpressResponse,
  ) {
    return proxyAuthResponse(
      res,
      await this.invitationService.createOrganizationInvitation(
        organizationId,
        body,
        extractHeaders(req),
      ),
    );
  }

  @Get("organizations/:organizationId/invitations")
  @ApiOperation({ summary: "Get invitations for an organization" })
  @ApiParam({ name: "organizationId", type: "string", format: "uuid" })
  async getOrganizationInvitations(
    @Param("organizationId", ParseUUIDPipe) organizationId: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: ExpressResponse,
  ) {
    return proxyAuthResponse(
      res,
      await this.invitationService.getOrganizationInvitations(organizationId, extractHeaders(req)),
    );
  }

  @Get("invitations")
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

  @Get("invitations/:invitationId")
  @ApiOperation({ summary: "Get an invitation by id" })
  async getInvitationById(
    @Param() params: InvitationIdDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: ExpressResponse,
  ) {
    return proxyAuthResponse(
      res,
      await this.invitationService.getInvitationById(params.invitationId, extractHeaders(req)),
    );
  }

  @Post("invitations/:invitationId/accept")
  @ApiOperation({ summary: "Accept an organization invitation" })
  async acceptInvitationById(
    @Param() params: InvitationIdDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: ExpressResponse,
  ) {
    return proxyAuthResponse(
      res,
      await this.invitationService.acceptInvitationById(params.invitationId, extractHeaders(req)),
    );
  }

  @Post("invitations/:invitationId/cancel")
  @ApiOperation({ summary: "Cancel a pending invitation" })
  async cancelInvitationById(
    @Param() params: InvitationIdDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: ExpressResponse,
  ) {
    return proxyAuthResponse(
      res,
      await this.invitationService.cancelInvitationById(params.invitationId, extractHeaders(req)),
    );
  }

  @Post("invitations/:invitationId/reject")
  @ApiOperation({ summary: "Reject an organization invitation" })
  async rejectInvitationById(
    @Param() params: InvitationIdDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: ExpressResponse,
  ) {
    return proxyAuthResponse(
      res,
      await this.invitationService.rejectInvitationById(params.invitationId, extractHeaders(req)),
    );
  }
}
