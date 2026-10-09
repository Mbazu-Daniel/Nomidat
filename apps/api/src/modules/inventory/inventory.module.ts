import { BatchController } from "./batch.controller";
import { BatchService } from "./batch.service";
import { CatalogController } from "./catalog.controller";
import { CatalogService } from "./catalog.service";
import { CycleCountService } from "./cycle-count.service";
import { PurchaseOrderService } from "./purchase-order.service";
import { ReturnService } from "./return.service";
import { SerialNumberService } from "./serial-number.service";
import { StockOperationsController } from "./stock-operations.controller";
import { StockService } from "./stock.service";
import { TransferService } from "./transfer.service";
import { UnitOfMeasureService } from "./unit-of-measure.service";
import { VariantService } from "./variant.service";
import { WarehouseController } from "./warehouse.controller";
import { WarehouseService } from "./warehouse.service";
import { Module } from "@nestjs/common";
import { BetterAuthModule } from "../../common/better-auth/better-auth.module";
import { DbModule } from "../../common/db/db.module";
import { FilesModule } from "../../common/files/files.module";
import { BusinessModule } from "../business/business.module";
import { InventoryController } from "./inventory.controller";
import { InventoryService } from "./inventory.service";

@Module({
  imports: [BetterAuthModule, DbModule, FilesModule, BusinessModule],
  controllers: [
    InventoryController,
    CatalogController,
    StockOperationsController,
    WarehouseController,
    BatchController,
  ],
  providers: [
    InventoryService,
    StockService,
    CatalogService,
    UnitOfMeasureService,
    VariantService,
    TransferService,
    CycleCountService,
    ReturnService,
    PurchaseOrderService,
    WarehouseService,
    BatchService,
    SerialNumberService,
  ],
  exports: [InventoryService, StockService, TransferService],
})
export class InventoryModule {}
