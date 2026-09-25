import { useEffect, useState } from "react";
import {
  IconBrandTelegram,
  IconBrandWhatsapp,
  IconCopy,
  IconRefresh,
  IconShieldCheck,
  IconLink,
  IconUnlink,
} from "@tabler/icons-react";
import { createApiRequest } from "@/lib/api";
import type { ChannelIdentity, ChannelLinkCode } from "@/lib/types";
import type { ChannelsPanelProps } from "./types";
import { ChannelProviderCards } from "./channel-provider-cards";
import "./channels.css";

export function ChannelsPanel({ organizationId, canWrite }: ChannelsPanelProps) {
  const [identities, setIdentities] = useState<ChannelIdentity[]>([]);
  const [linkCode, setLinkCode] = useState<ChannelLinkCode | null>(null);
  const [provider, setProvider] = useState("telegram");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);
  const [copied, setCopied] = useState(false);
  const [unlinking, setUnlinking] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const path = `/organizations/${organizationId}/channels`;
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    void createApiRequest<ChannelIdentity[]>(path)
      .then((rows) => {
        if (!cancelled) setIdentities(rows);
      })
      .catch((reason: Error) => {
        if (!cancelled) setError(reason.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [path, version]);
  useEffect(() => {
    if (!linkCode) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [linkCode]);
  const expired = linkCode !== null && now >= new Date(linkCode.expiresAt).getTime();
  async function createCode(selectedProvider: string) {
    setBusy(true);
    setError("");
    setCopied(false);
    try {
      const result = await createApiRequest<ChannelLinkCode>(path + "/link-codes", {
        method: "POST",
      });
      setProvider(selectedProvider);
      setLinkCode(result);
      setNow(Date.now());
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function unlink(id: string) {
    setBusy(true);
    setError("");
    try {
      await createApiRequest(`${path}/identities/${id}`, { method: "DELETE" });
      setIdentities((rows) => rows.filter((row) => row.id !== id));
      setUnlinking(null);
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function copyCode() {
    if (!linkCode) return;
    try {
      await navigator.clipboard.writeText(
        provider === "telegram" ? `/start ${linkCode.code}` : linkCode.code,
      );
      setCopied(true);
    } catch {
      setError("Could not copy automatically. Select and copy the code below.");
    }
  }
  return (
    <>
      <div className="workspace-heading">
        <div>
          <h1>Connected channels</h1>
          <p>Bring Nomidat into the conversations you already have.</p>
        </div>
        <span className="channels-secure">
          <IconShieldCheck size={17} /> Secure, one-time linking
        </span>
      </div>
      {error && (
        <p className="workspace-error" role="alert">
          {error}
        </p>
      )}
      <ChannelProviderCards
        identities={identities}
        loading={loading}
        busy={busy}
        onConnect={createCode}
      />
      {linkCode && (
        <section
          className="workspace-card channel-link-panel"
          aria-label="Channel linking instructions"
        >
          <div className="channel-link-heading">
            <div>
              <p className="workspace-eyebrow">ONE MORE STEP</p>
              <h2>Finish connecting {provider === "telegram" ? "Telegram" : "WhatsApp"}</h2>
            </div>
            <button className="workspace-secondary" onClick={() => setLinkCode(null)}>
              Dismiss
            </button>
          </div>
          <div className="channel-link-content">
            <div>
              <span className="channel-code-label">YOUR ONE-TIME CODE</span>
              <div className="channel-code">
                <code>{linkCode.code}</code>
                <button
                  className="workspace-secondary"
                  onClick={() => void copyCode()}
                  disabled={expired}
                >
                  <IconCopy size={16} />
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <p className="channel-expiry" role="status">
                {expired
                  ? "This code has expired. Generate a new code to continue."
                  : `Expires at ${new Date(linkCode.expiresAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}. Use it once and keep it private.`}
              </p>
              {expired && (
                <button
                  className="workspace-primary"
                  disabled={busy}
                  onClick={() => void createCode(provider)}
                >
                  Generate new code
                </button>
              )}
            </div>
            <ol className="channel-steps">
              <li>
                <span>1</span>Open{" "}
                {provider === "telegram"
                  ? "your Nomidat Telegram bot in a private chat"
                  : "your business’s Nomidat WhatsApp chat"}
                .
              </li>
              <li>
                <span>2</span>
                <div>
                  Send{" "}
                  {provider === "telegram" ? (
                    <code>/start {linkCode.code}</code>
                  ) : (
                    <code>{linkCode.code}</code>
                  )}{" "}
                  as a message.
                </div>
              </li>
              <li>
                <span>3</span>Wait for the confirmation, then refresh the linked accounts below.
              </li>
            </ol>
          </div>
        </section>
      )}
      <section className="workspace-card channels-accounts">
        <header>
          <div>
            <h2>
              Linked accounts <span className="workspace-count">{identities.length}</span>
            </h2>
            <p>Accounts connected to the selected business.</p>
          </div>
          <button
            className="workspace-secondary"
            disabled={loading || busy}
            onClick={() => setVersion((value) => value + 1)}
          >
            <IconRefresh size={16} />
            Refresh
          </button>
        </header>
        {loading ? (
          <div className="channels-empty" role="status">
            Loading your linked accounts…
          </div>
        ) : identities.length === 0 ? (
          <div className="channels-empty">
            <span className="channels-empty-icon">
              <IconLink size={25} stroke={1.5} />
            </span>
            <h3>Your next conversation starts here</h3>
            <p>Connect Telegram or WhatsApp above to manage your business from chat.</p>
          </div>
        ) : (
          <ul className="channel-account-list">
            {identities.map((identity) => (
              <li key={identity.id}>
                <span className={`channel-brand small ${identity.provider}`}>
                  {identity.provider === "telegram" ? (
                    <IconBrandTelegram size={22} />
                  ) : (
                    <IconBrandWhatsapp size={22} />
                  )}
                </span>
                <div className="channel-account-name">
                  <strong>{identity.displayName ?? identity.externalId}</strong>
                  <p>
                    {identity.provider} ·{" "}
                    {identity.lastInboundAt
                      ? `Last message ${new Date(identity.lastInboundAt).toLocaleDateString()}`
                      : "No messages yet"}
                  </p>
                </div>
                {canWrite &&
                  (unlinking === identity.id ? (
                    <div className="channel-unlink">
                      <span>Disconnect this account?</span>
                      <button
                        className="workspace-secondary"
                        disabled={busy}
                        onClick={() => setUnlinking(null)}
                      >
                        Cancel
                      </button>
                      <button
                        className="workspace-primary"
                        disabled={busy}
                        onClick={() => void unlink(identity.id)}
                      >
                        Disconnect
                      </button>
                    </div>
                  ) : (
                    <button
                      className="workspace-secondary"
                      disabled={busy}
                      onClick={() => setUnlinking(identity.id)}
                    >
                      <IconUnlink size={15} />
                      Disconnect
                    </button>
                  ))}
              </li>
            ))}
          </ul>
        )}
      </section>
      <p className="channels-footnote">
        <IconShieldCheck size={17} />
        Linked accounts follow your business permissions. Owners, admins and managers can disconnect
        accounts.
      </p>
    </>
  );
}
