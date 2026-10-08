import { ReceiptsService } from "./receipts.service";
import { AuditModule } from "../audit/audit.module";
import { BusinessModule } from "../business/business.module";
import { EngagementModule } from "../engagement/engagement.module";
import { InvoiceDocumentsController } from "./invoice-documents.controller";
import { InvoiceDeliveryService } from "./invoice-delivery.service";
import { MoneyModule } from "../money/money.module";
import { PublicInvoiceController } from "./public-invoice.controller";
import { TelegramClient } from "../telegram/telegram.client";
import { WhatsAppClient } from "../whatsapp/whatsapp.client";
import { EmailModule } from "../../common/email/email.module";
import { InvoiceNegotiationService } from "./invoice-negotiation.service";
import { InvoiceShareService } from "./invoice-share.service";
import { Module } from "@nestjs/common";
import { BetterAuthModule } from "../../common/better-auth/better-auth.module";
import { DbModule } from "../../common/db/db.module";
import { InvoicesController } from "./invoices.controller";
import { InvoicesService } from "./invoices.service";

@Module({
  imports: [
    AuditModule,
    EmailModule,
    BusinessModule,
    BetterAuthModule,
    DbModule,
    EngagementModule,
    MoneyModule,
  ],
  controllers: [InvoicesController, InvoiceDocumentsController, PublicInvoiceController],
  providers: [
    InvoiceNegotiationService,
    InvoiceShareService,
    ReceiptsService,
    InvoicesService,
    InvoiceDeliveryService,
    TelegramClient,
    WhatsAppClient,
  ],
  exports: [
    InvoicesService,
    InvoiceDeliveryService,
    InvoiceShareService,
    InvoiceNegotiationService,
  ],
})
export class InvoicesModule {}
