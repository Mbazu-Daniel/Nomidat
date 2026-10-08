import { createHash } from "node:crypto";
import {
  Body,
  ConflictException,
  Controller,
  Get,
  Inject,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { and, desc, eq } from "@nomidat/db";
import { storefrontDomain } from "@nomidat/db/schema";
import { DATABASE, type DbHandle } from "../../common/db/db.provider";
import { authorizeOrganization } from "../../common/helpers/organization-auth";
import { BusinessAuthService } from "../business/business-auth.service";
import { DomainVerificationService, dnsRecordFor } from "./domain-verification.service";
import { AddDomainDto } from "./dto/domain.dto";
import { StorefrontDomainKind } from "./types/storefront.type";

/** Seller-facing shop domains. Every route is org-scoped, so one shop cannot
 * read or claim a hostname belonging to another. */
@ApiTags("Storefront domains")
@Controller("organizations/:organizationId/storefront-domains")
export class StorefrontDomainController {
  constructor(
    private readonly auth: BusinessAuthService,
    private readonly domains: DomainVerificationService,
    @Inject(DATABASE) private readonly db: DbHandle,
  ) {}

  @Get()
  @ApiOperation({ summary: "Hostnames attached to this shop" })
  async getDomains(@Param("organizationId") org: string, @Req() req: Request) {
    await authorizeOrganization(this.auth, req, org, "inventory");
    const rows = await this.db
      .select({
        id: storefrontDomain.id,
        hostname: storefrontDomain.hostname,
        kind: storefrontDomain.kind,
        isPrimary: storefrontDomain.isPrimary,
        verifiedAt: storefrontDomain.verifiedAt,
      })
      .from(storefrontDomain)
      .where(eq(storefrontDomain.organizationId, org))
      .orderBy(desc(storefrontDomain.isPrimary), storefrontDomain.hostname);

    // A pending domain carries the record to create, so a seller who navigates
    // away and comes back is not stuck unable to finish.
    return rows.map((row) => ({
      ...row,
      dns: row.verifiedAt
        ? null
        : dnsRecordFor(row.hostname, this.verificationTokenFor(row.hostname)),
    }));
  }

  @Post()
  @ApiOperation({ summary: "Attach a hostname to this shop" })
  async addDomain(
    @Param("organizationId") org: string,
    @Body() body: AddDomainDto,
    @Req() req: Request,
  ) {
    await authorizeOrganization(this.auth, req, org, "inventory");
    const hostname = this.domains.assertClaimableHostname(body.hostname);

    const [existing] = await this.db
      .select({ id: storefrontDomain.id, organizationId: storefrontDomain.organizationId })
      .from(storefrontDomain)
      .where(eq(storefrontDomain.hostname, hostname))
      .limit(1);

    if (existing) {
      // The hostname column is globally unique, so a clash is a real conflict and
      // must not silently re-point someone else's shop.
      throw new ConflictException(
        existing.organizationId === org
          ? "That hostname is already attached to your shop."
          : "That hostname is already used by another shop.",
      );
    }

    const [created] = await this.db
      .insert(storefrontDomain)
      .values({
        organizationId: org,
        hostname,
        kind: body.kind ?? StorefrontDomainKind.CUSTOM,
      })
      .returning();

    return { ...created, verificationToken: this.verificationTokenFor(hostname) };
  }

  @Post(":domainId/verify")
  @ApiOperation({ summary: "Check the DNS TXT record and mark the hostname verified" })
  async verifyDomain(
    @Param("organizationId") org: string,
    @Param("domainId", ParseUUIDPipe) domainId: string,
    @Req() req: Request,
  ) {
    await authorizeOrganization(this.auth, req, org, "inventory");

    const [domain] = await this.db
      .select()
      .from(storefrontDomain)
      .where(and(eq(storefrontDomain.id, domainId), eq(storefrontDomain.organizationId, org)))
      .limit(1);

    if (!domain) throw new NotFoundException("Hostname not found.");

    return this.domains.verifyDomain(
      org,
      domain.hostname,
      this.verificationTokenFor(domain.hostname),
    );
  }

  /** Deterministic per-hostname token, so a seller can retry verification safely. */
  private verificationTokenFor(hostname: string): string {
    return createHash("sha256").update(`nomidat:verify:${hostname}`).digest("hex").slice(0, 32);
  }
}
