import { Module } from "@nestjs/common";
import { BetterAuthModule } from "../../common/better-auth/better-auth.module";
import { DbModule } from "../../common/db/db.module";
import { BusinessAuthService } from "../business/business-auth.service";
import { ReportsController } from "./reports.controller";
import { ReportsService } from "./reports.service";

@Module({
  imports: [BetterAuthModule, DbModule],
  controllers: [ReportsController],
  providers: [BusinessAuthService, ReportsService],
  exports: [ReportsService],
})
export class ReportsModule {}

