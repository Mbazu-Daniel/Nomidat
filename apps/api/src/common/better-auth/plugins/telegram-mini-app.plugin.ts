import { createAuthEndpoint, APIError } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { z } from "zod";
import {
  getTelegramDisplayName,
  getVerifiedTelegramMiniAppUser,
} from "./telegram-mini-app-init-data";

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
          let telegramUser;
          try {
            telegramUser = getVerifiedTelegramMiniAppUser(
              ctx.body.initData,
              options.botToken,
              options.maxAuthAgeSeconds,
            );
          } catch (error) {
            throw new APIError("UNAUTHORIZED", {
              message: error instanceof Error ? error.message : "Invalid Telegram initData",
            });
          }

          const accountId = String(telegramUser.id);
          const existing = await ctx.context.internalAdapter.findAccountByKey({
            providerId: "telegram",
            accountId,
          });

          let user =
            existing != null
              ? await ctx.context.internalAdapter.findUserById(existing.userId)
              : null;

          if (!user) {
            const created = await ctx.context.internalAdapter.createOAuthUser(
              {
                name: getTelegramDisplayName(telegramUser),
                email: `tg_${accountId}@telegram.local`,
                emailVerified: true,
                image: telegramUser.photo_url,
              },
              {
                providerId: "telegram",
                accountId,
              },
            );
            user = created.user;
          }

          const session = await ctx.context.internalAdapter.createSession(user.id);
          await setSessionCookie(ctx, { session, user });
          return ctx.json({ user, session });
        },
      ),
    },
  } as const;
}
