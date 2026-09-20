import { Module } from "@nestjs/common";
import { BetterAuthModule } from "../../common/better-auth/better-auth.module";
import { DbModule } from "../../common/db/db.module";
import { BusinessModule } from "../business/business.module";
import { SalesController } from "./sales.controller";
import { SalesService } from "./sales.service";

@Module({
  imports: [BetterAuthModule, DbModule, BusinessModule],
  controllers: [SalesController],
  providers: [SalesService],
})
export class SalesModule {}
