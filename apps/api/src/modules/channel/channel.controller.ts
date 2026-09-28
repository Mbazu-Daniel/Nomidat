import { Controller, Get, Param, ParseUUIDPipe, Post, Delete, Req } from "@nestjs/common";
import { ApiOperation, ApiParam, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { extractHeaders } from "../../common/helpers/auth-http";
import { BusinessAuthService } from "../business/business-auth.service";
import { ChannelService } from "./channel.service";
import { ChannelIdentityParamsDto } from "./dto";

@ApiTags("Channels")
@Controller()
export class ChannelController {
  constructor(
    private readonly channelService: ChannelService,
    private readonly channelAuthService: BusinessAuthService,
  ) {}

  @Get("organizations/:organizationId/channels")
  @ApiOperation({ summary: "Get linked channel identities for an organization" })
  @ApiParam({ name: "organizationId", type: "string", format: "uuid" })
  async getOrganizationChannelIdentities(
    @Param("organizationId", ParseUUIDPipe) organizationId: string,
    @Req() req: Request,
  ) {
    await this.channelAuthService.getSession(extractHeaders(req), organizationId);
    return this.channelService.getOrganizationChannelIdentities(organizationId);
  }

  @Post("organizations/:organizationId/channels/link-codes")
  @ApiOperation({ summary: "Create a one-time channel link code" })
  @ApiParam({ name: "organizationId", type: "string", format: "uuid" })
  async createOrganizationChannelLinkCode(
    @Param("organizationId", ParseUUIDPipe) organizationId: string,
    @Req() req: Request,
  ) {
    const { userId } = await this.channelAuthService.getSession(
      extractHeaders(req),
      organizationId,
    );
    return this.channelService.createOrganizationChannelLinkCode(organizationId, userId);
  }

  @Delete("organizations/:organizationId/channels/identities/:channelIdentityId")
  @ApiOperation({ summary: "Unlink a channel identity from an organization" })
  async deleteOrganizationChannelIdentity(
    @Param() params: ChannelIdentityParamsDto,
    @Req() req: Request,
  ) {
    await this.channelAuthService.authorize(extractHeaders(req), params.organizationId, true, "channels");
    await this.channelService.deleteOrganizationChannelIdentity(
      params.organizationId,
      params.channelIdentityId,
    );
    return { ok: true };
  }
}
