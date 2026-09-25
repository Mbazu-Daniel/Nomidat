import { useEffect, useState } from "react";
import { createApiRequest } from "@/lib/api";
import { IconDownload, IconSend } from "@tabler/icons-react";
import { InvoiceDocumentPreview } from "./invoice-document";
import type { ChannelIdentity } from "@/lib/types/channel.type";
import type { InvoiceDetail, InvoiceDetailProps } from "./types";

export function InvoiceDetailPanel({ organizationId, invoiceId, canWrite }: InvoiceDetailProps) {
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [channels, setChannels] = useState<ChannelIdentity[]>([]);
  const [channel, setChannel] = useState("email");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const path = `/organizations/${organizationId}/invoices/${invoiceId}`;
  useEffect(() => {
    let cancelled = false;
    void createApiRequest<InvoiceDetail>(path)
      .then((row) => {
        if (!cancelled) setInvoice(row);
      })
      .catch((reason: Error) => {
        if (!cancelled) setError(reason.message);
      });
    void createApiRequest<ChannelIdentity[]>(`/organizations/${organizationId}/channels`)
      .then((rows) => {
        if (!cancelled) setChannels(rows);
      })
      .catch((reason: Error) => {
        if (!cancelled) setError(reason.message);
      });
    return () => {
      cancelled = true;
    };
  }, [path, organizationId]);
  async function download() {
    setBusy(true);
    setError("");
    try {
      const blob = await createApiRequest<Blob>(path + "/pdf");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${invoice?.invoiceNumber ?? "invoice"}.pdf`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (reason) {
      setError((reason as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {error && (
        <p role="alert" className="workspace-error">
          {error}
        </p>
      )}
      {!invoice ? (
        <p>Loading invoice…</p>
      ) : (
        <>
          <div className="invoice-preview-toolbar">
            <div>
              <span className="invoice-label">DOCUMENT PREVIEW</span>
              <p>Ready to download or share with your customer.</p>
            </div>
            <button className="workspace-primary" disabled={busy} onClick={() => void download()}>
              <IconDownload size={17} /> Download PDF
            </button>
          </div>
          <InvoiceDocumentPreview invoice={invoice} />
          {canWrite && (
            <form
              className="workspace-form"
              onSubmit={async (event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                setBusy(true);
                setError("");
                setSent(false);
                try {
                  await createApiRequest(path + "/send", {
                    method: "POST",
                    body: JSON.stringify({
                      channel,
                      email: data.get("email") || undefined,
                      channelIdentityId: data.get("identity") || undefined,
                    }),
                  });
                  setSent(true);
                } catch (reason) {
                  setError((reason as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              <h3 className="invoice-delivery-heading">
                <IconSend size={19} /> Deliver this invoice
              </h3>
              <div className="workspace-form-grid">
                <label>
                  Delivery channel
                  <select
                    value={channel}
                    onChange={(event) => {
                      setChannel(event.target.value);
                      setSent(false);
                    }}
                  >
                    <option value="email">Email</option>
                    <option value="telegram">Linked Telegram chat</option>
                    <option value="whatsapp">Linked WhatsApp chat</option>
                  </select>
                </label>
                {channel === "email" ? (
                  <label>
                    Recipient email
                    <input name="email" type="email" required />
                  </label>
                ) : (
                  <label>
                    Recipient chat
                    <select name="identity" required>
                      <option value="">Choose a linked chat</option>
                      {channels
                        .filter((row) => row.provider === channel)
                        .map((row) => (
                          <option key={row.id} value={row.id}>
                            {row.displayName ?? row.externalId}
                          </option>
                        ))}
                    </select>
                  </label>
                )}
              </div>
              <button className="workspace-primary" disabled={busy}>
                {busy ? "Sending…" : "Send invoice"}
              </button>
              {sent && <p role="status">Invoice delivered.</p>}
            </form>
          )}
        </>
      )}
    </>
  );
}
