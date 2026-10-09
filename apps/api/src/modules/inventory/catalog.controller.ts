import {
  Body,
  Controller,
  Delete,
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
import { CatalogService } from "./catalog.service";
import {
  AssignProductToCategoriesDto,
  CreateProductCategoryDto,
  CreateSupplierDto,
  CreateUnitConversionDto,
  CreateUnitOfMeasureDto,
  UpdateProductCategoryDto,
  UpdateSupplierDto,
  UpdateUnitOfMeasureDto,
} from "./dto/catalog.dto";
import { UnitOfMeasureService } from "./unit-of-measure.service";

@ApiTags("Catalog")
@Controller("organizations/:organizationId")
export class CatalogController {
  constructor(
    private readonly auth: OrganizationAuthService,
    private readonly catalog: CatalogService,
    private readonly units: UnitOfMeasureService,
  ) {}

  @Get("units")
  @ApiOperation({ summary: "List units of measure" })
  async getUnits(@Param("organizationId") org: string, @Req() req: Request) {
    await authorizeInventory(this.auth, req, org);
    return this.units.getUnits(org);
  }

  @Post("units")
  @ApiOperation({ summary: "Create a unit of measure" })
  async createUnit(
    @Param("organizationId") org: string,
    @Body() body: CreateUnitOfMeasureDto,
    @Req() req: Request,
  ) {
    await authorizeInventory(this.auth, req, org);
    return this.units.createUnit(org, body);
  }

  @Patch("units/:unitId")
  @ApiOperation({ summary: "Update a unit of measure" })
  async updateUnit(
    @Param("organizationId") org: string,
    @Param("unitId", ParseUUIDPipe) unitId: string,
    @Body() body: UpdateUnitOfMeasureDto,
    @Req() req: Request,
  ) {
    await authorizeInventory(this.auth, req, org);
    return this.units.updateUnit(org, unitId, body);
  }

  @Get("unit-conversions")
  @ApiOperation({ summary: "List unit conversion factors" })
  async getConversions(@Param("organizationId") org: string, @Req() req: Request) {
    await authorizeInventory(this.auth, req, org);
    return this.units.getConversions(org);
  }

  @Post("unit-conversions")
  @ApiOperation({ summary: "Define how one unit converts to another" })
  async createConversion(
    @Param("organizationId") org: string,
    @Body() body: CreateUnitConversionDto,
    @Req() req: Request,
  ) {
    await authorizeInventory(this.auth, req, org);
    return this.units.createConversion(org, body);
  }

  @Get("product-categories")
  @ApiOperation({ summary: "List product categories" })
  async getCategories(@Param("organizationId") org: string, @Req() req: Request) {
    await authorizeInventory(this.auth, req, org);
    return this.catalog.getCategories(org);
  }

  @Post("product-categories")
  @ApiOperation({ summary: "Create a product category" })
  async createCategory(
    @Param("organizationId") org: string,
    @Body() body: CreateProductCategoryDto,
    @Req() req: Request,
  ) {
    await authorizeInventory(this.auth, req, org);
    return this.catalog.createCategory(org, body);
  }

  @Patch("product-categories/:categoryId")
  @ApiOperation({ summary: "Update a product category" })
  async updateCategory(
    @Param("organizationId") org: string,
    @Param("categoryId", ParseUUIDPipe) categoryId: string,
    @Body() body: UpdateProductCategoryDto,
    @Req() req: Request,
  ) {
    await authorizeInventory(this.auth, req, org);
    return this.catalog.updateCategory(org, categoryId, body);
  }

  @Delete("product-categories/:categoryId")
  @ApiOperation({ summary: "Archive a product category" })
  async archiveCategory(
    @Param("organizationId") org: string,
    @Param("categoryId", ParseUUIDPipe) categoryId: string,
    @Req() req: Request,
  ) {
    await authorizeInventory(this.auth, req, org);
    return this.catalog.archiveCategory(org, categoryId);
  }

  @Get("products/:productId/categories")
  @ApiOperation({ summary: "The categories a product currently sits in" })
  async getProductCategories(
    @Param("organizationId") org: string,
    @Param("productId", ParseUUIDPipe) productId: string,
    @Req() req: Request,
  ) {
    await authorizeInventory(this.auth, req, org);
    return this.catalog.getProductCategories(org, productId);
  }

  @Post("products/:productId/categories")
  @ApiOperation({ summary: "Replace the categories a product belongs to" })
  async assignCategories(
    @Param("organizationId") org: string,
    @Param("productId", ParseUUIDPipe) productId: string,
    @Body() body: AssignProductToCategoriesDto,
    @Req() req: Request,
  ) {
    await authorizeInventory(this.auth, req, org);
    return this.catalog.assignProductCategories(org, productId, body);
  }

  @Get("suppliers")
  @ApiOperation({ summary: "List suppliers" })
  async getSuppliers(
    @Param("organizationId") org: string,
    @Query("limit", new ParseIntPipe({ optional: true })) limit: number | undefined,
    @Req() req: Request,
  ) {
    await authorizeInventory(this.auth, req, org);
    return this.catalog.getSuppliers(org, limit);
  }

  @Post("suppliers")
  @ApiOperation({ summary: "Create a supplier" })
  async createSupplier(
    @Param("organizationId") org: string,
    @Body() body: CreateSupplierDto,
    @Req() req: Request,
  ) {
    await authorizeInventory(this.auth, req, org);
    return this.catalog.createSupplier(org, body);
  }

  @Patch("suppliers/:supplierId")
  @ApiOperation({ summary: "Update a supplier" })
  async updateSupplier(
    @Param("organizationId") org: string,
    @Param("supplierId", ParseUUIDPipe) supplierId: string,
    @Body() body: UpdateSupplierDto,
    @Req() req: Request,
  ) {
    await authorizeInventory(this.auth, req, org);
    return this.catalog.updateSupplier(org, supplierId, body);
  }
}
