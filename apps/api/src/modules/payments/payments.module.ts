import { PaymentNotificationService } from "./payment-notification.service";
import { PaymentReconciliationService } from "./payment-reconciliation.service";
import { TelegramClient } from "../telegram/telegram.client";
import { WhatsAppClient } from "../whatsapp/whatsapp.client";
import { BusinessProfileModule } from "../business-profile/business-profile.module";
import { PaymentLedgerService } from "./payment-ledger.service";
import { Module } from "@nestjs/common";
import { DbModule } from "../../common/db/db.module";
import { BusinessModule } from "../business/business.module";
import { PaymentsController } from "./payments.controller";
import { PaystackService } from "./providers/paystack/paystack.service";

@Module({
  imports: [BusinessProfileModule, DbModule, BusinessModule],
  controllers: [PaymentsController],
  providers: [
    PaystackService,
    PaymentLedgerService,
    PaymentNotificationService,
    PaymentReconciliationService,
    TelegramClient,
    WhatsAppClient,
  ],
  exports: [PaystackService],
})
export class PaymentsModule {}
