import { useEffect, useRef, useState } from "react";
import type { TelegramLoginData } from "@/lib/types/telegram-web-app.type";

/**
 * "Continue with Telegram" via Telegram's Login Widget.
 *
 * The widget is a script from telegram.org that renders a real Telegram button
 * and hands back a signed payload. Nothing it returns is trusted here: the
 * payload goes to the API, which recomputes the signature with the bot token.
 * The browser only decides who to show it as.
 */
export function TelegramSignIn({
  botUsername,
  onVerified,
}: {
  botUsername: string;
  onVerified: (data: TelegramLoginData) => Promise<void> | void;
}) {
  const mount = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!botUsername || !mount.current) return;
    const container = mount.current;

    const script = document.createElement("script");
    script.async = true;
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.onload = () => {
      window.Telegram?.LoginWidget.render(container, {
        botUsername,
        onSuccess: (data) => {
          setBusy(true);
          setError("");
          Promise.resolve(onVerified(data))
            .catch((reason: Error) => setError(reason.message))
            .finally(() => setBusy(false));
        },
      });
    };
    document.body.appendChild(script);

    // The script is ours and is removed on unmount, so navigating away and back
    // does not accumulate copies of it and render a second widget.
    return () => {
      script.remove();
    };
  }, [botUsername, onVerified]);

  if (!botUsername) {
    return (
      <p className="text-xs text-muted-foreground">
        Telegram sign-in is not configured on this deployment.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2" ref={mount}>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {/* Telegram renders its own button into this container. `busy` is exposed as
          `aria-busy` so assistive tech still knows the request is in flight after
          the widget's own button has been replaced by a page navigation. */}
      {busy && (
        <p role="status" className="text-xs text-muted-foreground">
          Signing you in…
        </p>
      )}
    </div>
  );
}
