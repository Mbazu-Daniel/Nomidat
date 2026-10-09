import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { authorizeInventory } from "./authorize-inventory";
import { OrganizationAuthService } from "../organization-summary/organization-auth.service";
import { CreateWarehouseDto, UpdateWarehouseDto } from "./dto/warehouse.dto";
import { WarehouseService } from "./warehouse.service";

@ApiTags("Warehouses")
@Controller("organizations/:organizationId")
export class WarehouseController {
  constructor(
    private readonly auth: OrganizationAuthService,
    private readonly warehouses: WarehouseService,
  ) {}

  @Get("warehouses")
  async list(@Param("organizationId") org: string, @Req() req: Request) {
    await authorizeInventory(this.auth, req, org);
    return this.warehouses.getWarehouses(org);
  }

  @Post("warehouses")
  async create(
    @Param("organizationId") org: string,
    @Body() body: CreateWarehouseDto,
    @Req() req: Request,
  ) {
    await authorizeInventory(this.auth, req, org);
    return this.warehouses.createWarehouse(org, body);
  }

  @Patch("warehouses/:warehouseId")
  async update(
    @Param("organizationId") org: string,
    @Param("warehouseId", ParseUUIDPipe) warehouseId: string,
    @Body() body: UpdateWarehouseDto,
    @Req() req: Request,
  ) {
    await authorizeInventory(this.auth, req, org);
    return this.warehouses.updateWarehouse(org, warehouseId, body);
  }

  @Get("stock-levels")
  @ApiOperation({ summary: "Stock held, by warehouse" })
  async getStockLevels(
    @Param("organizationId") org: string,
    @Query("warehouseId", ParseUUIDPipe) warehouseId: string | undefined,
    @Query("limit", new ParseIntPipe({ optional: true })) limit: number | undefined,
    @Query("offset", new ParseIntPipe({ optional: true })) offset: number | undefined,
    @Req() req: Request,
  ) {
    await authorizeInventory(this.auth, req, org);
    return this.warehouses.getStockLevels(org, warehouseId, limit, offset);
  }

  @Get("stock-movements")
  @ApiOperation({ summary: "The stock ledger, newest first" })
  async getMovements(
    @Param("organizationId") org: string,
    @Query("productId", ParseUUIDPipe) productId: string | undefined,
    @Query("limit", new ParseIntPipe({ optional: true })) limit: number | undefined,
    @Query("offset", new ParseIntPipe({ optional: true })) offset: number | undefined,
    @Req() req: Request,
  ) {
    await authorizeInventory(this.auth, req, org);
    return this.warehouses.getMovements(org, productId, limit, offset);
  }
}
