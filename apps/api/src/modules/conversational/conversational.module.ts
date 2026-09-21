import { Module } from "@nestjs/common";
import { DbModule } from "../../common/db/db.module";
import { SalesModule } from "../sales/sales.module";
import { ConversationalService } from "./conversational.service";

@Module({
  imports: [DbModule, SalesModule],
  providers: [ConversationalService],
  exports: [ConversationalService],
})
export class ConversationalModule {}
