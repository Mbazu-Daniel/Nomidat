import { Controller, Get, Param, Req, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { BETTER_AUTH, type BetterAuthInstance } from "../../common/better-auth";
import { extractHeaders } from "../../common/helpers/auth-http";
import { AuditService } from "../audit/audit.service";
import { Inject } from "@nestjs/common";
import { PlatformAdminGuard } from "./platform-admin.guard";
import { PlatformDatabaseService } from "./platform-database.service";

/**
 * Cross-tenant operations for the platform operator.
 *
 * Everything here is gated by PlatformAdminGuard, and every read is aggregate or
 * metadata. Tenant records are never returned in bulk: an operator who can page
 * through every customer's invoices and contacts is a liability, not a feature.
 */
@ApiTags("Platform")
@Controller("platform")
@UseGuards(PlatformAdminGuard)
export class PlatformController {
  constructor(
    private readonly guard: PlatformAdminGuard,
    private readonly database: PlatformDatabaseService,
    private readonly audit: AuditService,
    @Inject(BETTER_AUTH) private readonly auth: BetterAuthInstance,
  ) {}

  @Get("overview")
  @ApiOperation({ summary: "Cross-tenant platform totals" })
  async overview(@Req() req: Request) {
    await this.requireAdmin(req);
    return this.database.getOverview();
  }

  @Get("organizations")
  @ApiOperation({ summary: "List organizations with usage totals" })
  async getOrganizations(@Req() req: Request) {
    await this.requireAdmin(req);
    return this.database.getOrganizations();
  }

  /**
   * Looking inside one tenant is a deliberate, logged act rather than a filter on
   * the list, so it is a separate route that writes to the tenant's own trail.
   */
  @Get("organizations/:organizationId/activity")
  @ApiOperation({ summary: "Recent activity for one tenant" })
  async organizationActivity(
    @Req() req: Request,
    @Param("organizationId") organizationId: string,
  ) {
    const email = await this.requireAdmin(req);
    const activity = await this.database.getOrganizationActivity(organizationId);
    await this.audit.record(organizationId, { email, role: "platform" }, {
      action: "platform.tenant_viewed",
      entityType: "organization",
      entityId: organizationId,
    });
    return activity;
  }

  /** Resolves the caller's email and enforces the allow-list. */
  private async requireAdmin(req: Request): Promise<string> {
    const session = await this.auth.api.getSession({ headers: extractHeaders(req) });
    const email = session?.user?.email ?? null;
    this.guard.assertPlatformAdmin(email);
    return email as string;
  }
}
