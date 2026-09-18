import { createAuthEndpoint, APIError } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { z } from "zod";
import { resolveTelegramUser } from "./telegram-mini-app-init-data";

export type TelegramMiniAppPluginOptions = {
  botToken: string;
  maxAuthAgeSeconds?: number;
};

/**
 * Better Auth plugin: Mini App initData → session cookie.
 * Path: POST /api/v1/auth/sign-in/telegram
 */
export function telegramMiniApp(options: TelegramMiniAppPluginOptions) {
  return {
    id: "telegram-mini-app",
    endpoints: {
      signInTelegramMiniApp: createAuthEndpoint(
        "/sign-in/telegram",
        {
          method: "POST",
          body: z.object({
            initData: z.string().min(1),
          }),
        },
        async (ctx) => {
          let user;
          try {
            user = await resolveTelegramUser(
              ctx.body.initData,
              options.botToken,
              options.maxAuthAgeSeconds,
              ctx.context.internalAdapter,
            );
          } catch (error) {
            throw new APIError("UNAUTHORIZED", {
              message: error instanceof Error ? error.message : "Invalid Telegram initData",
            });
          }

          const session = await ctx.context.internalAdapter.createSession(user.id);
          await setSessionCookie(ctx, { session, user });
          return ctx.json({ user, session });
        },
      ),
    },
  } as const;
}
