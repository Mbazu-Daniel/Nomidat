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
import { authorizeOrganization } from "../../common/helpers/organization-auth";
import { BusinessAuthService } from "../business/business-auth.service";
import { CreateWarehouseDto, UpdateWarehouseDto } from "./dto/warehouse.dto";
import { WarehouseService } from "./warehouse.service";

@ApiTags("Warehouses")
@Controller("organizations/:organizationId")
export class WarehouseController {
  constructor(
    private readonly auth: BusinessAuthService,
    private readonly warehouses: WarehouseService,
  ) {}

  @Get("warehouses")
  async list(@Param("organizationId") org: string, @Req() req: Request) {
    await this.read(req, org);
    return this.warehouses.getWarehouses(org);
  }

  @Post("warehouses")
  async create(
    @Param("organizationId") org: string,
    @Body() body: CreateWarehouseDto,
    @Req() req: Request,
  ) {
    await this.write(req, org);
    return this.warehouses.createWarehouse(org, body);
  }

  @Patch("warehouses/:warehouseId")
  async update(
    @Param("organizationId") org: string,
    @Param("warehouseId", ParseUUIDPipe) warehouseId: string,
    @Body() body: UpdateWarehouseDto,
    @Req() req: Request,
  ) {
    await this.write(req, org);
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
    await this.read(req, org);
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
    await this.read(req, org);
    return this.warehouses.getMovements(org, productId, limit, offset);
  }

  private read(req: Request, org: string) {
    return authorizeOrganization(this.auth, req, org, "inventory");
  }

  private write(req: Request, org: string) {
    return authorizeOrganization(this.auth, req, org, "inventory");
  }
}