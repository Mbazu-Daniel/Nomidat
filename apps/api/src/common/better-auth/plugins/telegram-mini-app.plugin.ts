import { createAuthEndpoint, APIError } from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { z } from "zod";
import type { TelegramAuthUser, TelegramUserStore } from "./telegram-mini-app-init-data";
import { resolveTelegramUser } from "./telegram-mini-app-init-data";

export type TelegramMiniAppPluginOptions = {
  botToken: string;
  maxAuthAgeSeconds?: number;
};

/**
 * Better Auth plugin: Mini App initData → session cookie.
 * Path: POST /api/v1/auth/sign-in/telegram-mini-app
 */
export function telegramMiniApp(options: TelegramMiniAppPluginOptions) {
  return {
    id: "telegram-mini-app",
    endpoints: {
      signInTelegramMiniApp: createAuthEndpoint(
        "/sign-in/telegram-mini-app",
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
              // Better Auth owns the user shape. `TelegramAuthUser` is our own
              // approximation, kept so the resolve logic can be tested without a
              // database, so the two are reconciled here at the single boundary.
              ctx.context.internalAdapter as unknown as TelegramUserStore<TelegramAuthUser>,
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

      /**
       * Login Widget sign-in. The signature was already checked by
       * AuthTelegramService before this was called; see the plugin doc comment.
       */
      signInTelegramWidget: createAuthEndpoint(
        "/sign-in/telegram-widget",
        {
          method: "POST",
          body: z.object({
            id: z.string().min(1),
            firstName: z.string().min(1),
            lastName: z.string().optional(),
            username: z.string().optional(),
            photoUrl: z.string().optional(),
            authDate: z.number(),
          }),
        },
        async (ctx) => {
          const accountId = ctx.body.id;
          // `findAccountByKey` is Better Auth's own lookup. The earlier
          // `getAccountByKey` name did not exist on the adapter, so a repeat
          // sign-in threw instead of finding the account it had already made.
          const account = await ctx.context.internalAdapter.findAccountByKey({
            providerId: "telegram",
            accountId,
          });
          const existing =
            account != null ? await ctx.context.internalAdapter.findUserById(account.userId) : null;

          const user =
            existing ??
            (
              await ctx.context.internalAdapter.createOAuthUser(
                {
                  name: [ctx.body.firstName, ctx.body.lastName].filter(Boolean).join(" ").trim(),
                  email: `tg_${accountId}@telegram.local`,
                  emailVerified: true,
                  image: ctx.body.photoUrl,
                },
                { providerId: "telegram", accountId },
              )
            ).user;

          const session = await ctx.context.internalAdapter.createSession(user.id);
          await setSessionCookie(ctx, { session, user });
          return ctx.json({ user, session });
        },
      ),
    },
  } as const;
}
