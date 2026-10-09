import { ReceiptsService } from "./receipts.service";
import { AuditModule } from "../audit/audit.module";
import { OrganizationSummaryModule } from "../organization-summary/organization-summary.module";
import { EngagementModule } from "../engagement/engagement.module";
import { InvoiceDocumentsController } from "./invoice-documents.controller";
import { InvoiceDeliveryService } from "./invoice-delivery.service";
import { MoneyModule } from "../money/money.module";
import { PublicInvoiceController } from "./public-invoice.controller";
import { TelegramClient } from "../telegram/telegram.client";
import { WhatsAppClient } from "../whatsapp/whatsapp.client";
import { EmailModule } from "../../common/email/email.module";
import { FilesModule } from "../../common/files/files.module";
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
    OrganizationSummaryModule,
    BetterAuthModule,
    DbModule,
    // For the logo bytes the PDF embeds. Without a bucket the invoice still
    // renders, drawing the vector fallback.
    FilesModule,
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
