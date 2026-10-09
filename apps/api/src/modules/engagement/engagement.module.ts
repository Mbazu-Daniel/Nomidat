import { EngagementController } from "./engagement.controller";
import { EngagementService } from "./engagement.service";
import { Module } from "@nestjs/common";
import { OrganizationSummaryModule } from "../organization-summary/organization-summary.module";
import { DbModule } from "../../common/db/db.module";
import { WebhookDispatchService } from "./webhook-dispatch.service";

@Module({
  imports: [OrganizationSummaryModule, DbModule],
  controllers: [EngagementController],
  providers: [EngagementService, WebhookDispatchService],
  exports: [EngagementService, WebhookDispatchService],
})
export class EngagementModule {}
