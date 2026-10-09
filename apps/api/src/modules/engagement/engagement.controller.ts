import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { extractHeaders } from "../../common/helpers/auth-http";
import { BadRequestException } from "@nestjs/common";
import { OrganizationAuthService } from "../organization-summary/organization-auth.service";
import { CreateOutboundWebhookDto } from "./dto/create-outbound-webhook.dto";
import { EngagementService } from "./engagement.service";

@ApiTags("Engagement")
@Controller("organizations/:organizationId")
export class EngagementController {
  constructor(
    private readonly auth: OrganizationAuthService,
    private readonly engagement: EngagementService,
  ) {}

  @Get("announcements")
  @ApiOperation({ summary: "Announcements visible to this organization" })
  async getAnnouncements(@Param("organizationId") organizationId: string, @Req() req: Request) {
    await this.read(req, organizationId);
    return this.engagement.getAnnouncements(organizationId);
  }

  @Get("notifications")
  @ApiOperation({ summary: "The signed-in member's notifications" })
  async getNotifications(@Param("organizationId") organizationId: string, @Req() req: Request) {
    const session = await this.read(req, organizationId);
    return this.engagement.getNotifications(session.userId, organizationId);
  }

  @Patch("notifications/:notificationId/read")
  @ApiOperation({ summary: "Mark one of your notifications as read" })
  async markRead(
    @Param("organizationId") organizationId: string,
    @Param("notificationId") notificationId: string,
    @Req() req: Request,
  ) {
    const session = await this.read(req, organizationId);
    return this.engagement.markRead(session.userId, organizationId, notificationId);
  }

  @Get("webhooks")
  @ApiOperation({ summary: "List outbound webhook subscriptions" })
  async getWebhooks(@Param("organizationId") organizationId: string, @Req() req: Request) {
    await this.read(req, organizationId);
    return this.engagement.getWebhooks(organizationId);
  }

  @Post("webhooks")
  @ApiOperation({
    summary: "Subscribe an endpoint to organization events",
    description:
      "The signing secret is returned once here and never again. Store it when the subscription is created.",
  })
  async createWebhook(
    @Param("organizationId") organizationId: string,
    @Body() body: CreateOutboundWebhookDto,
    @Req() req: Request,
  ) {
    await this.write(req, organizationId);
    try {
      return await this.engagement.createWebhook(organizationId, body);
    } catch (error) {
      // The URL validator throws plain Errors on purpose (it is also used
      // outside HTTP); translate rather than leaking a 500 to the client.
      throw new BadRequestException((error as Error).message);
    }
  }

  @Delete("webhooks/:webhookId")
  @ApiOperation({ summary: "Remove a webhook subscription" })
  async deleteWebhook(
    @Param("organizationId") organizationId: string,
    @Param("webhookId") webhookId: string,
    @Req() req: Request,
  ) {
    await this.write(req, organizationId);
    return this.engagement.deleteWebhook(organizationId, webhookId);
  }

  private async read(req: Request, organizationId: string) {
    return this.auth.getSession(extractHeaders(req), organizationId);
  }

  private async write(req: Request, organizationId: string) {
    const session = await this.read(req, organizationId);
    this.auth.authorizeWrite(session.role, "settings");
    return session;
  }
}
