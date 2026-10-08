type TelegramWebAppUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
};

type TelegramWebApp = {
  initData: string;
  initDataUnsafe: {
    user?: TelegramWebAppUser;
  };
  ready: () => void;
  expand: () => void;
  close: () => void;
  colorScheme?: "light" | "dark";
};

/** The payload Telegram's Login Widget hands back on a normal web page. */
export type TelegramLoginData = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
};

declare global {
  interface Window {
    Telegram?: {
      /** Present inside a Mini App. */
      WebApp: TelegramWebApp;
      /** Present on any page once telegram-widget.js has loaded. */
      LoginWidget: {
        render: (
          container: HTMLElement,
          options: {
            botUsername: string;
            onSuccess: (data: TelegramLoginData) => void;
            onError?: (reason: string) => void;
          },
        ) => void;
      };
    };
  }
}

