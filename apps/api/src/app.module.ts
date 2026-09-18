import { Module } from "@nestjs/common";
import { EnvModule } from "./common/config/env.module";
import { DbModule } from "./common/db/db.module";
import { EmailModule } from "./common/email/email.module";
import { BetterAuthModule } from "./common/better-auth/better-auth.module";
import { AuthModule } from "./modules/auth/auth.module";
import { OrganizationModule } from "./modules/organization/organization.module";
import { MemberModule } from "./modules/member/member.module";
import { InvitationModule } from "./modules/invitation/invitation.module";
// TODO(channels): re-enable with channel/telegram/whatsapp modules
// import { ChannelModule } from "./modules/channel/channel.module";
// import { TelegramModule } from "./modules/telegram/telegram.module";
// import { WhatsAppModule } from "./modules/whatsapp/whatsapp.module";

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
    // TODO(channels): re-enable with channel/telegram/whatsapp modules
    // ChannelModule,
    // TelegramModule,
    // WhatsAppModule,
  ],
})
export class AppModule {}
