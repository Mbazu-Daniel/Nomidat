import { Module } from "@nestjs/common";
import { BetterAuthModule } from "../../common/better-auth/better-auth.module";
import { DbModule } from "../../common/db/db.module";
import { OrganizationAuthService } from "../organization-summary/organization-auth.service";
import { ReportsController } from "./reports.controller";
import { InventoryHealthService } from "./inventory-health.service";
import { ReportsService } from "./reports.service";

@Module({
  imports: [BetterAuthModule, DbModule],
  controllers: [ReportsController],
  providers: [OrganizationAuthService, ReportsService, InventoryHealthService],
  exports: [ReportsService, InventoryHealthService],
})
export class ReportsModule {}
