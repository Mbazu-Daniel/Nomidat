import { Module } from "@nestjs/common";
import { DbModule } from "../../common/db/db.module";
import { ChannelAuthService } from "./channel-auth.service";
import { ChannelController } from "./channel.controller";
import { ConversationalModule } from "../conversational/conversational.module";
import { ChannelInboundService } from "./channel-inbound.service";
import { ChannelService } from "./channel.service";

@Module({
  imports: [DbModule, ConversationalModule],
  controllers: [ChannelController],
  providers: [ChannelService, ChannelAuthService, ChannelInboundService],
  exports: [ChannelService, ChannelInboundService],
})
export class ChannelModule {}
