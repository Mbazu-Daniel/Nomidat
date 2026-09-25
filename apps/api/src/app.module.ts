import { ContactsModule } from "./modules/contacts/contacts.module";
import { PictureImportModule } from "./modules/picture-import/picture-import.module";
import { Module } from "@nestjs/common";
import { EnvModule } from "./common/config/env.module";
import { DbModule } from "./common/db/db.module";
import { EmailModule } from "./common/email/email.module";
import { BetterAuthModule } from "./common/better-auth/better-auth.module";
import { AuthModule } from "./modules/auth/auth.module";
import { OrganizationModule } from "./modules/organization/organization.module";
import { MemberModule } from "./modules/member/member.module";
import { InvitationModule } from "./modules/invitation/invitation.module";
import { ChannelModule } from "./modules/channel/channel.module";
import { TelegramModule } from "./modules/telegram/telegram.module";
import { WhatsAppModule } from "./modules/whatsapp/whatsapp.module";
import { BusinessModule } from "./modules/business/business.module";
import { ConversationalModule } from "./modules/conversational/conversational.module";
import { SalesModule } from "./modules/sales/sales.module";
import { InvoicesModule } from "./modules/invoices/invoices.module";
import { PaymentsModule } from "./modules/payments/payments.module";
import { ReportsModule } from "./modules/reports/reports.module";
import { InventoryModule } from "./modules/inventory/inventory.module";
import { ExpensesModule } from "./modules/expenses/expenses.module";

@Module({
  imports: [
    PictureImportModule,
    ContactsModule,
    EnvModule,
    DbModule,
    EmailModule,
    BetterAuthModule,
    AuthModule,
    OrganizationModule,
    MemberModule,
    InvitationModule,
    ChannelModule,
    TelegramModule,
    WhatsAppModule,
    BusinessModule,
    SalesModule,
    InvoicesModule,
    PaymentsModule,
    InventoryModule,
    ExpensesModule,
    ReportsModule,
    ConversationalModule,
  ],
})
export class AppModule {}
