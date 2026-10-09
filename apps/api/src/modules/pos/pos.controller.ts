import { Body, Controller, Get, Param, Post, Req } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { authorizeOrganization } from "../../common/helpers/organization-auth";
import { OrganizationAuthService } from "../organization-summary/organization-auth.service";
import { CreatePosSaleDto } from "./dto";
import { PosService } from "./pos.service";
import { MoneyPolicyService } from "../money/money-policy.service";

@ApiTags("POS")
@Controller("organizations/:organizationId/pos")
export class PosController {
  constructor(
    private readonly auth: OrganizationAuthService,
    private readonly pos: PosService,
    private readonly money: MoneyPolicyService,
  ) {}

  @Get("money-policy")
  @ApiOperation({ summary: "The business currency and tax rate" })
  async getMoneyPolicy(@Param("organizationId") organizationId: string, @Req() req: Request) {
    await authorizeOrganization(this.auth, req, organizationId, "sales");
    return this.money.getPolicy(organizationId);
  }

  @Get("catalog")
  @ApiOperation({ summary: "List products available to the point-of-sale terminal" })
  async getCatalog(@Param("organizationId") organizationId: string, @Req() req: Request) {
    await authorizeOrganization(this.auth, req, organizationId, "sales");
    return this.pos.getCatalogProducts(organizationId);
  }

  @Post("sales")
  @ApiOperation({ summary: "Check out a point-of-sale sale" })
  async createPosSale(
    @Param("organizationId") organizationId: string,
    @Body() body: CreatePosSaleDto,
    @Req() req: Request,
  ) {
    const session = await authorizeOrganization(this.auth, req, organizationId, "sales");
    return this.pos.createPosSale(organizationId, session.userId, body);
  }
}
