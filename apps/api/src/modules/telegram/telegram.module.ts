import { Module } from "@nestjs/common";
import { ChannelModule } from "../channel/channel.module";
import { TelegramClient } from "./telegram.client";
import { TelegramController } from "./telegram.controller";

@Module({
  imports: [ChannelModule],
  controllers: [TelegramController],
  providers: [TelegramClient],
  exports: [TelegramClient],
})
export class TelegramModule {}
