import { createApiRequest } from "./api";

export type TelegramSessionResult = { ok: true; userName: string } | { ok: false; message: string };

export type TelegramWebAppLike = {
  initData?: string;
  initDataUnsafe?: { user?: { first_name?: string } | null };
  ready: () => void;
  expand: () => void;
};

export async function createTelegramSession(
  webApp: TelegramWebAppLike | null | undefined,
  request: (initData: string) => Promise<{ user?: { name?: string | null } | null }> = (initData) =>
    createApiRequest<{ user?: { name?: string | null } | null }>("/auth/sign-in/telegram", {
      method: "POST",
      body: JSON.stringify({ initData }),
    }),
): Promise<TelegramSessionResult> {
  if (!webApp?.initData) {
    return { ok: false, message: "Open this page from your Telegram bot Mini App." };
  }

  webApp.ready();
  webApp.expand();

  try {
    const result = await request(webApp.initData);
    return {
      ok: true,
      userName: result.user?.name ?? webApp.initDataUnsafe?.user?.first_name ?? "there",
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Telegram sign-in failed",
    };
  }
}
