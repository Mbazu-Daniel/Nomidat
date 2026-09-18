import { Module } from "@nestjs/common";
import { ChannelModule } from "../channel/channel.module";
import { WhatsAppClient } from "./whatsapp.client";
import { WhatsAppController } from "./whatsapp.controller";

@Module({
  imports: [ChannelModule],
  controllers: [WhatsAppController],
  providers: [WhatsAppClient],
  exports: [WhatsAppClient],
})
export class WhatsAppModule {}
