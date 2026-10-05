import { Controller, Get, Param, ParseIntPipe, Query, Req } from "@nestjs/common";
import { ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { extractHeaders } from "../../common/helpers/auth-http";
import { AuditService } from "./audit.service";
import { BusinessAuthService } from "../business/business-auth.service";

const SUMMARY_DAYS = 30;

@ApiTags("Audit")
@Controller("organizations/:organizationId")
export class AuditController {
  constructor(
    private readonly auth: BusinessAuthService,
    private readonly audit: AuditService,
  ) {}

  @Get("audit-log")
  @ApiOperation({ summary: "Read the organization's activity trail" })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "offset", required: false, type: Number })
  async list(
    @Param("organizationId") organizationId: string,
    @Req() req: Request,
    @Query("limit", new ParseIntPipe({ optional: true })) limit?: number,
    @Query("offset", new ParseIntPipe({ optional: true })) offset?: number,
  ) {
    await this.auth.authorize(extractHeaders(req), organizationId);
    return this.audit.list(organizationId, limit ?? 50, offset ?? 0);
  }

  /**
   * Read access, like the list. An audit trail that only an owner can read is not
   * much use for the managers it is meant to reassure.
   */
  @Get("audit-log/summary")
  @ApiOperation({ summary: "Count recent activity by action" })
  async summarize(@Param("organizationId") organizationId: string, @Req() req: Request) {
    await this.auth.authorize(extractHeaders(req), organizationId);
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - SUMMARY_DAYS);
    return this.audit.summarize(organizationId, since);
  }

  @Get("audit-log/:entityType/:entityId")
  @ApiOperation({ summary: "Everything done to a single record" })
  async getForEntity(
    @Param("organizationId") organizationId: string,
    @Param("entityType") entityType: string,
    @Param("entityId") entityId: string,
    @Req() req: Request,
  ) {
    await this.auth.authorize(extractHeaders(req), organizationId);
    return this.audit.getForEntity(organizationId, entityType, entityId);
  }
}
