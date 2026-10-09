import { Module } from "@nestjs/common";
import { BetterAuthModule } from "../../common/better-auth/better-auth.module";
import { DbModule } from "../../common/db/db.module";
import { OrganizationAuthService } from "./organization-auth.service";
import { OrganizationSummaryController } from "./organization-summary.controller";
import { OrganizationSummaryService } from "./organization-summary.service";

@Module({
  imports: [BetterAuthModule, DbModule],
  controllers: [OrganizationSummaryController],
  providers: [OrganizationAuthService, OrganizationSummaryService],
  exports: [OrganizationAuthService, OrganizationSummaryService],
})
export class OrganizationSummaryModule {}
