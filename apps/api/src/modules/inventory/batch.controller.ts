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
import { BatchService } from "./batch.service";
import { ConsumeBatchDto, CreateBatchDto } from "./dto/batch.dto";
import { RegisterSerialDto, UpdateSerialStatusDto } from "./dto/serial-number.dto";
import { SerialNumberService } from "./serial-number.service";

@ApiTags("Batch and serial tracking")
@Controller("organizations/:organizationId")
export class BatchController {
  constructor(
    private readonly auth: BusinessAuthService,
    private readonly batches: BatchService,
    private readonly serials: SerialNumberService,
  ) {}

  @Get("batches")
  @ApiOperation({ summary: "Batches, soonest expiry first" })
  async getBatches(
    @Param("organizationId") org: string,
    @Query("productId", ParseUUIDPipe) productId: string | undefined,
    @Query("expiringBefore") expiringBefore: string | undefined,
    @Query("limit", new ParseIntPipe({ optional: true })) limit: number | undefined,
    @Query("offset", new ParseIntPipe({ optional: true })) offset: number | undefined,
    @Req() req: Request,
  ) {
    await this.write(req, org);
    return this.batches.getBatches(
      org,
      productId,
      expiringBefore ? new Date(expiringBefore) : undefined,
      limit,
      offset,
    );
  }

  @Post("batches")
  @ApiOperation({ summary: "Register a batch and book the goods in" })
  async createBatch(
    @Param("organizationId") org: string,
    @Body() body: CreateBatchDto,
    @Req() req: Request,
  ) {
    const session = await this.write(req, org);
    return this.batches.createBatch(org, body, session.userId);
  }

  @Post("batches/:batchId/consume")
  @ApiOperation({ summary: "Draw quantity from a batch" })
  async consumeBatch(
    @Param("organizationId") org: string,
    @Param("batchId", ParseUUIDPipe) batchId: string,
    @Body() body: ConsumeBatchDto,
    @Req() req: Request,
  ) {
    const session = await this.write(req, org);
    return this.batches.consumeBatch(org, batchId, body, session.userId);
  }

  @Get("serial-numbers")
  @ApiOperation({ summary: "Individually tracked units" })
  async getSerials(
    @Param("organizationId") org: string,
    @Query("productId", ParseUUIDPipe) productId: string | undefined,
    @Query("status") status: string | undefined,
    @Query("limit", new ParseIntPipe({ optional: true })) limit: number | undefined,
    @Query("offset", new ParseIntPipe({ optional: true })) offset: number | undefined,
    @Req() req: Request,
  ) {
    await this.write(req, org);
    return this.serials.getSerials(org, productId, status, limit, offset);
  }

  @Post("serial-numbers")
  @ApiOperation({ summary: "Register serialised units and book them in" })
  async registerSerials(
    @Param("organizationId") org: string,
    @Body() body: RegisterSerialDto,
    @Req() req: Request,
  ) {
    const session = await this.write(req, org);
    return this.serials.registerSerials(org, body, session.userId);
  }

  @Patch("serial-numbers/:serialNumberId")
  @ApiOperation({ summary: "Move a serial through its lifecycle" })
  async updateStatus(
    @Param("organizationId") org: string,
    @Param("serialNumberId", ParseUUIDPipe) serialNumberId: string,
    @Body() body: UpdateSerialStatusDto,
    @Req() req: Request,
  ) {
    await this.write(req, org);
    return this.serials.updateStatus(org, serialNumberId, body);
  }

  private write(req: Request, org: string) {
    return authorizeOrganization(this.auth, req, org, "inventory");
  }
}