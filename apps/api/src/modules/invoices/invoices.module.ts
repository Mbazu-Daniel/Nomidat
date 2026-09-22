import { Module } from "@nestjs/common";
import { BetterAuthModule } from "../../common/better-auth/better-auth.module";
import { DbModule } from "../../common/db/db.module";
import { InvoicesController } from "./invoices.controller";
import { InvoicesService } from "./invoices.service";

@Module({
  imports: [BetterAuthModule, DbModule],
  controllers: [InvoicesController],
  providers: [InvoicesService],
})
export class InvoicesModule {}

