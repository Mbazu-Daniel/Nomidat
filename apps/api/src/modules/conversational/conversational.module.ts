import { Module } from "@nestjs/common";
import { DbModule } from "../../common/db/db.module";
import { ConversationalService } from "./conversational.service";

@Module({
  imports: [DbModule],
  providers: [ConversationalService],
  exports: [ConversationalService],
})
export class ConversationalModule {}

