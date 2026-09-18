import { Global, Module } from "@nestjs/common";
import { createEmailClient, type EmailClient } from "@nomidat/email";
import { API_ENV } from "../config/env.module";
import type { ApiEnv } from "../config/env";
import { EMAIL_CLIENT } from "./email.constants";

export { EMAIL_CLIENT } from "./email.constants";

@Global()
@Module({
  providers: [
    {
      provide: EMAIL_CLIENT,
      inject: [API_ENV],
      useFactory: async (env: ApiEnv): Promise<EmailClient | null> => {
        if (!env.ZEPTOMAIL_TOKEN || !env.ZEPTOMAIL_FROM_ADDRESS) {
          return null;
        }

        return createEmailClient({
          token: env.ZEPTOMAIL_TOKEN,
          url: env.ZEPTOMAIL_URL,
          from: {
            address: env.ZEPTOMAIL_FROM_ADDRESS,
            name: env.ZEPTOMAIL_FROM_NAME,
          },
        });
      },
    },
  ],
  exports: [EMAIL_CLIENT],
})
export class EmailModule {}
