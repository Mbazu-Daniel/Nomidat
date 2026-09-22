import { Global, Module } from "@nestjs/common";
import { createDb } from "@nomidat/db";
import { sendOrganizationInvitationEmail, type EmailClient } from "@nomidat/email";
import { API_ENV } from "../config/env.module";
import type { ApiEnv } from "../config/env";
import { EMAIL_CLIENT, EmailModule } from "../email/email.module";
import { BETTER_AUTH } from "./better-auth.constants";
import { createBetterAuth, type BetterAuthInstance } from "./create-better-auth";

@Global()
@Module({
  imports: [EmailModule],
  providers: [
    {
      provide: BETTER_AUTH,
      inject: [API_ENV, EMAIL_CLIENT],
      useFactory: (env: ApiEnv, email: EmailClient | null): BetterAuthInstance => {
        const db = createDb(env.DATABASE_URL);

        return createBetterAuth({
          db,
          secret: env.BETTER_AUTH_SECRET,
          baseURL: env.BETTER_AUTH_URL,
          webOrigin: env.WEB_ORIGIN,
          telegramBotToken: env.TELEGRAM_BOT_TOKEN,
          google:
            env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
              ? {
                  clientId: env.GOOGLE_CLIENT_ID,
                  clientSecret: env.GOOGLE_CLIENT_SECRET,
                }
              : undefined,
          // Better Auth invokes this when invitations are created; email is owned by EmailModule.
          sendInvitationEmail: email
            ? async (data) => {
                await sendOrganizationInvitationEmail(email, {
                  email: data.email,
                  invitedByUsername: data.inviter.user.name,
                  invitedByEmail: data.inviter.user.email,
                  organizationName: data.organization.name,
                  inviteLink: `${env.WEB_ORIGIN}/accept-invitation/${data.id}`,
                });
              }
            : undefined,
        });
      },
    },
  ],
  exports: [BETTER_AUTH],
})
export class BetterAuthModule {}
