import { Module } from "@nestjs/common";
import { DbModule } from "../../common/db/db.module";
import { ReportsModule } from "../reports/reports.module";
import { ConversationalService } from "./conversational.service";

@Module({
  imports: [DbModule, ReportsModule],
  providers: [ConversationalService],
  exports: [ConversationalService],
})
export class ConversationalModule {}
