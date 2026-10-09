import { PaymentNotificationService } from "./payment-notification.service";
import { PaymentProviderRegistry } from "./providers/payment-provider-registry.service";
import { PaymentReconciliationService } from "./payment-reconciliation.service";
import { PaystackProvider } from "./providers/paystack/paystack.provider";
import { TelegramClient } from "../telegram/telegram.client";
import { WhatsAppClient } from "../whatsapp/whatsapp.client";
import { PaymentLedgerService } from "./payment-ledger.service";
import { Module } from "@nestjs/common";
import { DbModule } from "../../common/db/db.module";
import { OrganizationSummaryModule } from "../organization-summary/organization-summary.module";
import { EngagementModule } from "../engagement/engagement.module";
import { PaymentsController } from "./payments.controller";
import { PayoutsModule } from "../payouts/payouts.module";
import { PaystackService } from "./providers/paystack/paystack.service";

@Module({
  imports: [PayoutsModule, DbModule, OrganizationSummaryModule, EngagementModule],
  controllers: [PaymentsController],
  providers: [
    PaystackService,
    PaystackProvider,
    // Built explicitly rather than through a multi-provider token. Nest 12 injects
    // a single binding of that token directly rather than as an array, and the
    // `multiple` flag no longer exists in the type, so the token buys nothing here.
    // Adding a provider is one line in the factory and one in `inject`.
    {
      provide: PaymentProviderRegistry,
      useFactory: (paystack: PaystackProvider) => new PaymentProviderRegistry([paystack]),
      inject: [PaystackProvider],
    },
    PaymentLedgerService,
    PaymentNotificationService,
    PaymentReconciliationService,
    TelegramClient,
    WhatsAppClient,
  ],
  exports: [PaystackService, PaystackProvider, PaymentProviderRegistry, PaymentLedgerService],
})
export class PaymentsModule {}
