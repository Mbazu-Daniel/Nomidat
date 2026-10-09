import { Module } from "@nestjs/common";
import { BetterAuthModule } from "../../common/better-auth/better-auth.module";
import { DbModule } from "../../common/db/db.module";
import { OrganizationSummaryModule } from "../organization-summary/organization-summary.module";
import { EngagementModule } from "../engagement/engagement.module";
import { InventoryModule } from "../inventory/inventory.module";
import { MoneyModule } from "../money/money.module";
import { SalesController } from "./sales.controller";
import { SalePricingService } from "./sale-pricing.service";
import { SalesPersistenceService } from "./sales-persistence.service";
import { SalesQueriesService } from "./sales-queries.service";
import { SalesService } from "./sales.service";

@Module({
  imports: [
    BetterAuthModule,
    DbModule,
    OrganizationSummaryModule,
    InventoryModule,
    MoneyModule,
    EngagementModule,
  ],
  controllers: [SalesController],
  providers: [SalesService, SalesQueriesService, SalesPersistenceService, SalePricingService],
  // Contacts reads the customer balance through this seam rather than keeping its
  // own copy of the arithmetic. The pricing seam is exported so a POS terminal and a
  // public shop both learn what a thing costs from one place.
  exports: [SalesService, SalesQueriesService, SalePricingService],
})
export class SalesModule {}
