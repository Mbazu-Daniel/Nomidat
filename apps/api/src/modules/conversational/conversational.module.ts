import { ChannelPictureReader } from "./channel-picture-reader";
import { PictureActionsService } from "./picture-actions.service";
import { InventoryModule } from "../inventory/inventory.module";
import { PictureImportModule } from "../picture-import/picture-import.module";
import { BusinessModule } from "../business/business.module";
import { ActionsService } from "./actions.service";
import { AiService } from "./ai.service";
import { ConversationalController } from "./conversational.controller";
import { ContactsModule } from "../contacts/contacts.module";
import { InvoicesModule } from "../invoices/invoices.module";
import { PaymentsModule } from "../payments/payments.module";
import { ExtendedActionsService } from "./extended-actions.service";
import { Module } from "@nestjs/common";
import { DbModule } from "../../common/db/db.module";
import { ReportsModule } from "../reports/reports.module";
import { SalesModule } from "../sales/sales.module";
import { ConversationalService } from "./conversational.service";

@Module({
  imports: [
    PictureImportModule,
    InventoryModule,
    ContactsModule,
    InvoicesModule,
    PaymentsModule,
    BusinessModule,
    DbModule,
    SalesModule,
    ReportsModule,
  ],
  controllers: [ConversationalController],
  providers: [
    ChannelPictureReader,
    PictureActionsService,
    ConversationalService,
    ActionsService,
    AiService,
    ExtendedActionsService,
  ],
  exports: [ConversationalService],
})
export class ConversationalModule {}
