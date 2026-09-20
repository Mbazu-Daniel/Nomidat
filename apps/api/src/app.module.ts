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

@Module({
  imports: [
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
  ],
})
export class AppModule {}
