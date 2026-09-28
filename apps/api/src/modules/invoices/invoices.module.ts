import { ReceiptsService } from "./receipts.service";
import { BusinessModule } from "../business/business.module";
import { InvoiceDocumentsController } from "./invoice-documents.controller";
import { InvoiceDeliveryService } from "./invoice-delivery.service";
import { TelegramClient } from "../telegram/telegram.client";
import { WhatsAppClient } from "../whatsapp/whatsapp.client";
import { EmailModule } from "../../common/email/email.module";
import { Module } from "@nestjs/common";
import { BetterAuthModule } from "../../common/better-auth/better-auth.module";
import { DbModule } from "../../common/db/db.module";
import { InvoicesController } from "./invoices.controller";
import { InvoicesService } from "./invoices.service";

@Module({
  imports: [EmailModule, BusinessModule, BetterAuthModule, DbModule],
  controllers: [InvoicesController, InvoiceDocumentsController],
  providers: [
    ReceiptsService,
    InvoicesService,
    InvoiceDeliveryService,
    TelegramClient,
    WhatsAppClient,
  ],
  exports: [InvoicesService, InvoiceDeliveryService],
})
export class InvoicesModule {}
