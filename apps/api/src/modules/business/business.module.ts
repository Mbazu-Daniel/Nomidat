import { Module } from "@nestjs/common";
import { BetterAuthModule } from "../../common/better-auth/better-auth.module";
import { DbModule } from "../../common/db/db.module";
import { BusinessAuthService } from "./business-auth.service";
import { BusinessController } from "./business.controller";
import { BusinessService } from "./business.service";

@Module({
  imports: [BetterAuthModule, DbModule],
  controllers: [BusinessController],
  providers: [BusinessAuthService, BusinessService],
})
export class BusinessModule {}
