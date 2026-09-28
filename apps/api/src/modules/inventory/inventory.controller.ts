import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import { ApiOperation, ApiQuery, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { authorizeOrganization } from "../../common/helpers/organization-auth";
import { BusinessAuthService } from "../business/business-auth.service";
import { AdjustStockDto, CreateProductDto, UpdateProductDto } from "./dto";
import { InventoryService } from "./inventory.service";

@ApiTags("Inventory")
@Controller("organizations/:organizationId")
export class InventoryController {
  constructor(
    private readonly auth: BusinessAuthService,
    private readonly inventory: InventoryService,
  ) {}

  @Post("products")
  @ApiOperation({ summary: "Create a product" })
  async createProduct(
    @Param("organizationId") organizationId: string,
    @Body() body: CreateProductDto,
    @Req() req: Request,
  ) {
    await this.authorize(req, organizationId);
    return this.inventory.createProduct(organizationId, body);
  }

  @Get("products")
  @ApiOperation({ summary: "List products" })
  @ApiQuery({ name: "limit", required: false, type: Number, maximum: 50 })
  async listProducts(
    @Param("organizationId") organizationId: string,
    @Req() req: Request,
    @Query("limit", new ParseIntPipe({ optional: true })) limit?: number,
    @Query("offset", new ParseIntPipe({ optional: true })) offset?: number,
  ) {
    await this.authorize(req, organizationId);
    return this.inventory.listProducts(organizationId, limit, offset);
  }

  @Get("products/:productId")
  @ApiOperation({ summary: "Get a product" })
  async getProduct(
    @Param("organizationId") organizationId: string,
    @Param("productId") productId: string,
    @Req() req: Request,
  ) {
    await this.authorize(req, organizationId);
    return this.inventory.getProduct(organizationId, productId);
  }

  @Patch("products/:productId")
  @ApiOperation({ summary: "Update a product" })
  async updateProduct(
    @Param("organizationId") organizationId: string,
    @Param("productId") productId: string,
    @Body() body: UpdateProductDto,
    @Req() req: Request,
  ) {
    await this.authorize(req, organizationId);
    return this.inventory.updateProduct(organizationId, productId, body);
  }

  @Delete("products/:productId")
  @ApiOperation({ summary: "Archive a product" })
  async archiveProduct(
    @Param("organizationId") organizationId: string,
    @Param("productId") productId: string,
    @Req() req: Request,
  ) {
    await this.authorize(req, organizationId);
    return this.inventory.archiveProduct(organizationId, productId);
  }

  @Post("products/:productId/stock-adjustments")
  @ApiOperation({ summary: "Adjust product stock" })
  async adjustStock(
    @Param("organizationId") organizationId: string,
    @Param("productId") productId: string,
    @Body() body: AdjustStockDto,
    @Req() req: Request,
  ) {
    await this.authorize(req, organizationId);
    return this.inventory.adjustStock(organizationId, productId, body);
  }

  private authorize(req: Request, organizationId: string) {
    return authorizeOrganization(this.auth, req, organizationId, "inventory");
  }
}
