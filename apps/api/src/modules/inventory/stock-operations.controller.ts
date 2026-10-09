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
import { CycleCountService } from "./cycle-count.service";
import {
  CreateCycleCountDto,
  CreatePurchaseOrderDto,
  CreateReturnDto,
  CreateTransferDto,
  ReceivePurchaseOrderDto,
} from "./dto/stock-operations.dto";
import { CreateVariantDto, UpdateVariantDto } from "./dto/variant.dto";
import { PurchaseOrderService } from "./purchase-order.service";
import { ReturnService } from "./return.service";
import { TransferService } from "./transfer.service";
import { VariantService } from "./variant.service";

@ApiTags("Stock operations")
@Controller("organizations/:organizationId")
export class StockOperationsController {
  constructor(
    private readonly auth: OrganizationAuthService,
    private readonly transfers: TransferService,
    private readonly counts: CycleCountService,
    private readonly returns: ReturnService,
    private readonly purchasing: PurchaseOrderService,
    private readonly variants: VariantService,
  ) {}

  @Get("stock-transfers")
  async getTransfers(
    @Param("organizationId") org: string,
    @Query("limit", new ParseIntPipe({ optional: true })) limit: number | undefined,
    @Req() req: Request,
  ) {
    await authorizeInventory(this.auth, req, org);
    return this.transfers.getTransfers(org, limit);
  }

  @Post("stock-transfers")
  async createTransfer(
    @Param("organizationId") org: string,
    @Body() body: CreateTransferDto,
    @Req() req: Request,
  ) {
    await authorizeInventory(this.auth, req, org);
    return this.transfers.createTransfer(org, body);
  }

  @Post("stock-transfers/:transferId/dispatch")
  @ApiOperation({ summary: "Send the goods out of the source warehouse" })
  async dispatchTransfer(
    @Param("organizationId") org: string,
    @Param("transferId", ParseUUIDPipe) transferId: string,
    @Req() req: Request,
  ) {
    const session = await authorizeInventory(this.auth, req, org);
    return this.transfers.dispatchTransfer(org, session.userId, transferId);
  }

  @Post("stock-transfers/:transferId/receive")
  @ApiOperation({ summary: "Book the goods into the destination warehouse" })
  async receiveTransfer(
    @Param("organizationId") org: string,
    @Param("transferId", ParseUUIDPipe) transferId: string,
    @Req() req: Request,
  ) {
    const session = await authorizeInventory(this.auth, req, org);
    return this.transfers.receiveTransfer(org, session.userId, transferId);
  }

  @Post("stock-transfers/:transferId/cancel")
  @ApiOperation({ summary: "Cancel a draft, or bring the goods back from transit" })
  async cancelTransfer(
    @Param("organizationId") org: string,
    @Param("transferId", ParseUUIDPipe) transferId: string,
    @Req() req: Request,
  ) {
    const session = await authorizeInventory(this.auth, req, org);
    return this.transfers.cancelTransfer(org, session.userId, transferId);
  }

  @Get("cycle-counts")
  async getCycleCounts(
    @Param("organizationId") org: string,
    @Query("limit", new ParseIntPipe({ optional: true })) limit: number | undefined,
    @Req() req: Request,
  ) {
    await authorizeInventory(this.auth, req, org);
    return this.counts.getCycleCounts(org, limit);
  }

  @Post("cycle-counts")
  @ApiOperation({ summary: "Record what the counter physically found" })
  async createCycleCount(
    @Param("organizationId") org: string,
    @Body() body: CreateCycleCountDto,
    @Req() req: Request,
  ) {
    const session = await authorizeInventory(this.auth, req, org);
    return this.counts.createCycleCount(org, session.userId, body);
  }

  @Post("cycle-counts/:cycleCountId/apply")
  @ApiOperation({ summary: "Post the difference as a correction" })
  async applyCycleCount(
    @Param("organizationId") org: string,
    @Param("cycleCountId", ParseUUIDPipe) cycleCountId: string,
    @Req() req: Request,
  ) {
    const session = await authorizeInventory(this.auth, req, org);
    return this.counts.applyCycleCount(org, session.userId, cycleCountId);
  }

  @Get("returns")
  async getReturns(
    @Param("organizationId") org: string,
    @Query("limit", new ParseIntPipe({ optional: true })) limit: number | undefined,
    @Req() req: Request,
  ) {
    await authorizeInventory(this.auth, req, org);
    return this.returns.getReturns(org, limit);
  }

  @Post("returns")
  async createReturn(
    @Param("organizationId") org: string,
    @Body() body: CreateReturnDto,
    @Req() req: Request,
  ) {
    const session = await authorizeInventory(this.auth, req, org);
    return this.returns.createReturn(org, session.userId, body);
  }

  @Post("returns/:returnId/receive")
  async receiveReturn(
    @Param("organizationId") org: string,
    @Param("returnId", ParseUUIDPipe) returnId: string,
    @Query("warehouseId", ParseUUIDPipe) warehouseId: string,
    @Req() req: Request,
  ) {
    const session = await authorizeInventory(this.auth, req, org);
    return this.returns.receiveReturn(org, session.userId, returnId, warehouseId);
  }

  @Get("purchase-orders")
  async getPurchaseOrders(
    @Param("organizationId") org: string,
    @Query("limit", new ParseIntPipe({ optional: true })) limit: number | undefined,
    @Req() req: Request,
  ) {
    await authorizeInventory(this.auth, req, org);
    return this.purchasing.getPurchaseOrders(org, limit);
  }

  @Post("purchase-orders")
  async createPurchaseOrder(
    @Param("organizationId") org: string,
    @Body() body: CreatePurchaseOrderDto,
    @Req() req: Request,
  ) {
    const session = await authorizeInventory(this.auth, req, org);
    return this.purchasing.createPurchaseOrder(org, session.userId, body);
  }

  @Get("purchase-orders/:purchaseOrderId")
  @ApiOperation({ summary: "One purchase order with its lines" })
  async getPurchaseOrder(
    @Param("organizationId") org: string,
    @Param("purchaseOrderId", ParseUUIDPipe) purchaseOrderId: string,
    @Req() req: Request,
  ) {
    await authorizeInventory(this.auth, req, org);
    return this.purchasing.getPurchaseOrder(org, purchaseOrderId);
  }

  @Post("purchase-orders/:purchaseOrderId/receive")
  @ApiOperation({ summary: "Book in what physically arrived" })
  async receivePurchaseOrder(
    @Param("organizationId") org: string,
    @Param("purchaseOrderId", ParseUUIDPipe) purchaseOrderId: string,
    @Body() body: ReceivePurchaseOrderDto,
    @Req() req: Request,
  ) {
    const session = await authorizeInventory(this.auth, req, org);
    return this.purchasing.receivePurchaseOrder(org, session.userId, purchaseOrderId, body);
  }

  @Get("products/:productId/variants")
  async getVariants(
    @Param("organizationId") org: string,
    @Param("productId", ParseUUIDPipe) productId: string,
    @Req() req: Request,
  ) {
    await authorizeInventory(this.auth, req, org);
    return this.variants.list(org, productId);
  }

  @Post("products/:productId/variants")
  async createVariant(
    @Param("organizationId") org: string,
    @Param("productId", ParseUUIDPipe) productId: string,
    @Body() body: CreateVariantDto,
    @Req() req: Request,
  ) {
    await authorizeInventory(this.auth, req, org);
    return this.variants.create(org, productId, body);
  }

  @Patch("products/:productId/variants/:variantId")
  async updateVariant(
    @Param("organizationId") org: string,
    @Param("productId", ParseUUIDPipe) productId: string,
    @Param("variantId", ParseUUIDPipe) variantId: string,
    @Body() body: UpdateVariantDto,
    @Req() req: Request,
  ) {
    await authorizeInventory(this.auth, req, org);
    return this.variants.update(org, productId, variantId, body);
  }
}
