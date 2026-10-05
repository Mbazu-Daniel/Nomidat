import { EngagementController } from "./engagement.controller";
import { EngagementService } from "./engagement.service";
import { Module } from "@nestjs/common";
import { BusinessModule } from "../business/business.module";
import { DbModule } from "../../common/db/db.module";
import { WebhookDispatchService } from "./webhook-dispatch.service";

@Module({
  imports: [BusinessModule, DbModule],
  controllers: [EngagementController],
  providers: [EngagementService, WebhookDispatchService],
  exports: [EngagementService, WebhookDispatchService],
})
export class EngagementModule {}
