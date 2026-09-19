import { createFileRoute, Link } from "@tanstack/react-router";
import { IconBrandTelegram, IconBrandWhatsapp, IconLink, IconUnlink } from "@tabler/icons-react";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { createApiRequest } from "@/lib/api";
import type { ChannelIdentity, ChannelLinkCode } from "@/lib/types";

export const Route = createFileRoute("/channels")({
  component: ChannelsPage,
});

function ChannelsPage() {
  const [organizationId, setOrganizationId] = useState("");
  const [identities, setIdentities] = useState<ChannelIdentity[]>([]);
  const [linkCode, setLinkCode] = useState<ChannelLinkCode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!organizationId.trim()) {
      setIdentities([]);
      return;
    }
    startTransition(async () => {
      try {
        setError(null);
        const rows = await createApiRequest<ChannelIdentity[]>(
          `/organizations/${encodeURIComponent(organizationId.trim())}/channels`,
        );
        setIdentities(rows);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load channels");
      }
    });
  }, [organizationId]);

  function createLinkCode() {
    const orgId = organizationId.trim();
    if (!orgId) {
      setError("Organization id is required");
      return;
    }
    startTransition(async () => {
      try {
        setError(null);
        const created = await createApiRequest<ChannelLinkCode>(
          `/organizations/${encodeURIComponent(orgId)}/channels/link-codes`,
          {
            method: "POST",
          },
        );
        setLinkCode(created);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create link code");
      }
    });
  }

  function deleteIdentity(channelIdentityId: string) {
    const orgId = organizationId.trim();
    if (!orgId) return;
    startTransition(async () => {
      try {
        setError(null);
        await createApiRequest(
          `/organizations/${encodeURIComponent(orgId)}/channels/identities/${encodeURIComponent(channelIdentityId)}`,
          {
            method: "DELETE",
          },
        );
        setIdentities((prev) => prev.filter((row) => row.id !== channelIdentityId));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to unlink channel");
      }
    });
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-10 px-6 py-16">
      <header className="flex flex-col gap-2">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">
          ← nomidat
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight">Channels</h1>
        <p className="text-muted-foreground">
          Link Telegram or WhatsApp to your organization with a one-time code.
        </p>
      </header>

      <section className="flex flex-col gap-3">
        <label className="text-sm font-medium" htmlFor="organizationId">
          Organization id
        </label>
        <input
          id="organizationId"
          value={organizationId}
          onChange={(event) => setOrganizationId(event.target.value)}
          placeholder="Active organization UUID"
          className="h-9 rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-medium">Link code</h2>
          <Button type="button" onClick={createLinkCode} disabled={pending}>
            <IconLink data-icon="inline-start" />
            Generate code
          </Button>
        </div>
        {linkCode ? (
          <div className="flex flex-col gap-3 border-t border-border pt-4">
            <p className="font-mono text-3xl tracking-[0.2em]">{linkCode.code}</p>
            <p className="text-sm text-muted-foreground">
              Expires {new Date(linkCode.expiresAt).toLocaleString()}
            </p>
            <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <IconBrandTelegram className="mt-0.5 size-4 shrink-0" />
                Telegram: open your bot and send{" "}
                <code className="text-foreground">/start {linkCode.code}</code>
              </li>
              <li className="flex items-start gap-2">
                <IconBrandWhatsapp className="mt-0.5 size-4 shrink-0" />
                WhatsApp: send <code className="text-foreground">{linkCode.code}</code> as a text
                message
              </li>
            </ul>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Generate a code, then send it from the channel you want to link.
          </p>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium">Linked channels</h2>
        {identities.length === 0 ? (
          <p className="text-sm text-muted-foreground">No channels linked yet.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {identities.map((identity) => (
              <li key={identity.id} className="flex items-center justify-between gap-4 py-3">
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="flex items-center gap-2 text-sm font-medium capitalize">
                    {identity.provider === "telegram" ? (
                      <IconBrandTelegram className="size-4" />
                    ) : (
                      <IconBrandWhatsapp className="size-4" />
                    )}
                    {identity.provider}
                  </span>
                  <span className="truncate text-sm text-muted-foreground">
                    {identity.displayName ?? identity.externalId}
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => deleteIdentity(identity.id)}
                  disabled={pending}
                >
                  <IconUnlink data-icon="inline-start" />
                  Unlink
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
    </main>
  );
}
