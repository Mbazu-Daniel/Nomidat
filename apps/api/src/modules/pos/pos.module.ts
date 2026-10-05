import { Module } from "@nestjs/common";
import { BetterAuthModule } from "../../common/better-auth/better-auth.module";
import { DbModule } from "../../common/db/db.module";
import { AuditModule } from "../audit/audit.module";
import { BusinessModule } from "../business/business.module";
import { MoneyModule } from "../money/money.module";
import { SalesModule } from "../sales/sales.module";
import { PosController } from "./pos.controller";
import { PosTotalsService } from "./pos-totals.service";
import { PosService } from "./pos.service";

@Module({
  imports: [BetterAuthModule, DbModule, BusinessModule, SalesModule, MoneyModule, AuditModule],
  controllers: [PosController],
  providers: [PosService, PosTotalsService],
  exports: [PosService],
})
export class PosModule {}