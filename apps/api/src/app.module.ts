import { APP_GUARD } from "@nestjs/core";
import { ContactsModule } from "./modules/contacts/contacts.module";
import { PayoutsModule } from "./modules/payouts/payouts.module";
import { EngagementModule } from "./modules/engagement/engagement.module";
import { AuditModule } from "./modules/audit/audit.module";
import { PlatformModule } from "./modules/platform/platform.module";
import { PictureImportModule } from "./modules/picture-import/picture-import.module";
import { Module } from "@nestjs/common";
import { EnvModule } from "./common/config/env.module";
import { DbModule } from "./common/db/db.module";
import { EmailModule } from "./common/email/email.module";
import { FilesModule } from "./common/files/files.module";
import { BetterAuthModule } from "./common/better-auth/better-auth.module";
import { AuthModule } from "./modules/auth/auth.module";
import { OrganizationModule } from "./modules/organization/organization.module";
import { MemberModule } from "./modules/member/member.module";
import { InvitationModule } from "./modules/invitation/invitation.module";
import { ChannelModule } from "./modules/channel/channel.module";
import { TelegramModule } from "./modules/telegram/telegram.module";
import { WhatsAppModule } from "./modules/whatsapp/whatsapp.module";
import { OrganizationSummaryModule } from "./modules/organization-summary/organization-summary.module";
import { MemberProfileModule } from "./modules/member-profile/member-profile.module";
import { ConversationalModule } from "./modules/conversational/conversational.module";
import { MoneyModule } from "./modules/money/money.module";
import { StorefrontModule } from "./modules/storefront/storefront.module";
import { SalesModule } from "./modules/sales/sales.module";
import { PosModule } from "./modules/pos/pos.module";
import { InvoicesModule } from "./modules/invoices/invoices.module";
import { PaymentsModule } from "./modules/payments/payments.module";
import { ReportsModule } from "./modules/reports/reports.module";
import { InventoryModule } from "./modules/inventory/inventory.module";
import { ExpensesModule } from "./modules/expenses/expenses.module";
import { OrgContextGuard } from "./common/guards/org-context.guard";

@Module({
  imports: [
    PayoutsModule,
    EngagementModule,
    AuditModule,
    PlatformModule,
    PictureImportModule,
    ContactsModule,
    EnvModule,
    DbModule,
    EmailModule,
    FilesModule,
    BetterAuthModule,
    AuthModule,
    OrganizationModule,
    MemberModule,
    InvitationModule,
    ChannelModule,
    TelegramModule,
    WhatsAppModule,
    OrganizationSummaryModule,
    MemberProfileModule,
    SalesModule,
    PosModule,
    StorefrontModule,
    MoneyModule,
    InvoicesModule,
    PaymentsModule,
    InventoryModule,
    ExpensesModule,
    ReportsModule,
    ConversationalModule,
  ],
  providers: [
    // Default-deny, so authentication is a property of the route table rather
    // than of every handler remembering to call `authorize`. Ordered before the
    // per-controller guards so an unauthenticated request is rejected before
    // any of them spend work on it.
    { provide: APP_GUARD, useClass: OrgContextGuard },
  ],
})
export class AppModule {}
