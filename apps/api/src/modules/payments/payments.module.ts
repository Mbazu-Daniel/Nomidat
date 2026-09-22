import { Module } from "@nestjs/common";
import { DbModule } from "../../common/db/db.module";
import { BusinessModule } from "../business/business.module";
import { PaymentsController } from "./payments.controller";
import { PaystackService } from "./paystack.service";

@Module({
  imports: [DbModule, BusinessModule],
  controllers: [PaymentsController],
  providers: [PaystackService],
  exports: [PaystackService],
})
export class PaymentsModule {}
