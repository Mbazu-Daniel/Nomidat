import { createHmac, timingSafeEqual } from "node:crypto";

type TelegramMiniAppUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
  is_premium?: boolean;
};

const DEFAULT_MAX_AUTH_AGE_SECONDS = 86_400;

function getVerifiedTelegramMiniAppUser(
  initData: string,
  botToken: string,
  maxAuthAgeSeconds = DEFAULT_MAX_AUTH_AGE_SECONDS,
): TelegramMiniAppUser {
  const params = new URLSearchParams(initData);
  const hash = params.get("hash");
  if (!hash) {
    throw new Error("Missing Telegram initData hash");
  }

  params.delete("hash");
  const dataCheckString = [...params.entries()]
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join("\n");

  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const calculatedHash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");

  const expected = Buffer.from(calculatedHash, "utf8");
  const provided = Buffer.from(hash, "utf8");
  if (expected.length !== provided.length || !timingSafeEqual(expected, provided)) {
    throw new Error("Invalid Telegram initData signature");
  }

  const authDateRaw = params.get("auth_date");
  if (!authDateRaw) {
    throw new Error("Missing Telegram auth_date");
  }
  const authDate = Number(authDateRaw);
  if (!Number.isFinite(authDate)) {
    throw new Error("Invalid Telegram auth_date");
  }
  if (Math.floor(Date.now() / 1000) - authDate > maxAuthAgeSeconds) {
    throw new Error("Telegram initData expired");
  }

  const userRaw = params.get("user");
  if (!userRaw) {
    throw new Error("Missing Telegram user in initData");
  }

  const user = JSON.parse(userRaw) as TelegramMiniAppUser;
  if (!user?.id) {
    throw new Error("Invalid Telegram user payload");
  }
  return user;
}

function getTelegramDisplayName(user: TelegramMiniAppUser): string {
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();
  return fullName || user.username || `Telegram ${user.id}`;
}

export type TelegramUserStore<TUser extends { id: string }> = {
  findAccountByKey: (key: {
    providerId: string;
    accountId: string;
  }) => Promise<{ userId: string } | null>;
  findUserById: (userId: string) => Promise<TUser | null>;
  createOAuthUser: (
    user: { name: string; email: string; emailVerified: boolean; image?: string },
    account: { providerId: string; accountId: string },
  ) => Promise<{ user: TUser }>;
};

export async function resolveTelegramUser<TUser extends { id: string }>(
  initData: string,
  botToken: string,
  maxAuthAgeSeconds: number | undefined,
  store: TelegramUserStore<TUser>,
): Promise<TUser> {
  const telegramUser = getVerifiedTelegramMiniAppUser(initData, botToken, maxAuthAgeSeconds);
  const accountId = String(telegramUser.id);
  const existing = await store.findAccountByKey({ providerId: "telegram", accountId });
  const user = existing != null ? await store.findUserById(existing.userId) : null;
  if (user) {
    return user;
  }
  const created = await store.createOAuthUser(
    {
      name: getTelegramDisplayName(telegramUser),
      email: `tg_${accountId}@telegram.local`,
      emailVerified: true,
      image: telegramUser.photo_url,
    },
    { providerId: "telegram", accountId },
  );
  return created.user;
}
