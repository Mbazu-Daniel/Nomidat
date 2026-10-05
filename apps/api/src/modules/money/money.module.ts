import { MoneyPolicyService } from "./money-policy.service";
import { Module } from "@nestjs/common";
import { DbModule } from "../../common/db/db.module";

@Module({
  imports: [DbModule],
  providers: [MoneyPolicyService],
  exports: [MoneyPolicyService],
})
export class MoneyModule {}
