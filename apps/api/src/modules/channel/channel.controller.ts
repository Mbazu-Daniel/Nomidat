import { Body, Controller, Delete, Get, Post, Query, Req } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { extractHeaders } from "../../common/helpers/auth-http";
import { ChannelAuthService } from "./channel-auth.service";
import { ChannelService } from "./channel.service";
import {
  CreateChannelLinkCodeDto,
  DeleteChannelIdentityDto,
  GetChannelIdentitiesQueryDto,
} from "./dto";

@ApiTags("Channels")
@Controller("channels")
export class ChannelController {
  constructor(
    private readonly channelService: ChannelService,
    private readonly channelAuthService: ChannelAuthService,
  ) {}

  @Get()
  @ApiOperation({ summary: "Get linked channel identities for an organization" })
  async getChannelIdentities(
    @Query() query: GetChannelIdentitiesQueryDto,
    @Req() req: Request,
  ) {
    await this.channelAuthService.getAuthorizedOrganizationUser(
      extractHeaders(req),
      query.organizationId,
    );
    return this.channelService.getChannelIdentities(query.organizationId);
  }

  @Post("link-codes")
  @ApiOperation({ summary: "Create a one-time channel link code" })
  async createChannelLinkCode(@Body() body: CreateChannelLinkCodeDto, @Req() req: Request) {
    const { userId, organizationId } =
      await this.channelAuthService.getAuthorizedOrganizationUser(
        extractHeaders(req),
        body.organizationId,
      );
    return this.channelService.createChannelLinkCode(organizationId, userId);
  }

  @Delete("identities")
  @ApiOperation({ summary: "Unlink a channel identity from an organization" })
  async deleteChannelIdentity(@Body() body: DeleteChannelIdentityDto, @Req() req: Request) {
    await this.channelAuthService.getAuthorizedOrganizationUser(
      extractHeaders(req),
      body.organizationId,
    );
    await this.channelService.deleteChannelIdentity(
      body.organizationId,
      body.channelIdentityId,
    );
    return { ok: true };
  }
}
