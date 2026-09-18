import { createHmac, timingSafeEqual } from "node:crypto";

export type TelegramMiniAppUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
  is_premium?: boolean;
};

const DEFAULT_MAX_AUTH_AGE_SECONDS = 86_400;

export function getVerifiedTelegramMiniAppUser(
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

export function getTelegramDisplayName(user: TelegramMiniAppUser): string {
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();
  return fullName || user.username || `Telegram ${user.id}`;
}
