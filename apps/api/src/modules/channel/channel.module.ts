import { Module } from "@nestjs/common";
import { DbModule } from "../../common/db/db.module";
import { OrganizationSummaryModule } from "../organization-summary/organization-summary.module";
import { ChannelController } from "./channel.controller";
import { ConversationalModule } from "../conversational/conversational.module";
import { ChannelInboundService } from "./channel-inbound.service";
import { ChannelService } from "./channel.service";

@Module({
  imports: [OrganizationSummaryModule, DbModule, ConversationalModule],
  controllers: [ChannelController],
  providers: [ChannelService, ChannelInboundService],
  exports: [ChannelService, ChannelInboundService],
})
export class ChannelModule {}
