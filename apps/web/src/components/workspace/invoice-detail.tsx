import { useState } from "react";
import { createApiRequest } from "@/lib/api";
import { useLoadedResource, useSubmit } from "@/lib/use-api-resource";
import { IconDownload, IconSend } from "@tabler/icons-react";
import { InvoiceDocumentPreview } from "./invoice-document";
import { InvoiceEditForm } from "./invoice-edit-form";
import { InvoiceOffers } from "./invoice-offers";
import type { ChannelIdentity } from "@/lib/types/channel.type";
import type { InvoiceDetail, InvoiceDetailProps } from "./types";

/**
 * Mirrors CLOSED_INVOICE_STATUSES on the API: those three are refused there for
 * both edit and delete, so hiding the controls here is what stops the seller
 * meeting an error they could not have predicted.
 */
const CLOSED_STATUSES = ["paid", "void", "cancelled"];

export function InvoiceDetailPanel({
  organizationId,
  invoiceId,
  canWrite,
  onSaved,
  onClose,
}: InvoiceDetailProps) {
  const [channel, setChannel] = useState("email");
  const [sent, setSent] = useState(false);
  // Whether the correction form is open. Its draft lives in that form, so
  // closing it here cannot leave half-edited numbers in the panel.
  const [editing, setEditing] = useState(false);
  // Bumped after a counter-offer is accepted, because the total has moved and
  // the preview above it is now showing a superseded amount.
  const [revision, setRevision] = useState(0);
  const path = `/organizations/${organizationId}/invoices/${invoiceId}`;
  const loaded = useLoadedResource(
    async () => {
      const [invoice, channels] = await Promise.all([
        createApiRequest<InvoiceDetail>(path),
        createApiRequest<ChannelIdentity[]>(`/organizations/${organizationId}/channels`),
      ]);
      return { invoice, channels };
    },
    [path, organizationId, revision],
    { invoice: null, channels: [] as ChannelIdentity[] } as {
      invoice: InvoiceDetail | null;
      channels: ChannelIdentity[];
    },
  );
  const invoice = loaded.data.invoice;
  const channels = loaded.data.channels;
  const { busy, error, submit } = useSubmit();
  async function download() {
    await submit(async () => {
      const blob = await createApiRequest<Blob>(path + "/pdf");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${invoice?.invoiceNumber ?? "invoice"}.pdf`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    });
  }
  async function removeInvoice() {
    if (!invoice) return;
    if (!window.confirm(`Delete ${invoice.invoiceNumber}? This cannot be undone.`)) return;
    const removed = await submit(async () => {
      await createApiRequest(path, { method: "DELETE" });
    });
    if (removed) onClose();
  }
  const closed = invoice ? CLOSED_STATUSES.includes(invoice.status ?? "draft") : false;
  const editable = canWrite && Boolean(invoice) && !closed;
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
            <div className="workspace-actions">
              {editable && !editing && (
                <button
                  type="button"
                  className="workspace-secondary"
                  disabled={busy}
                  onClick={() => setEditing(true)}
                >
                  Edit
                </button>
              )}
              {editable && !editing && (
                <button
                  type="button"
                  className="workspace-secondary"
                  disabled={busy}
                  onClick={() => void removeInvoice()}
                >
                  Delete
                </button>
              )}
              <button className="workspace-primary" disabled={busy} onClick={() => void download()}>
                <IconDownload size={17} /> Download PDF
              </button>
            </div>
          </div>
          <InvoiceDocumentPreview invoice={invoice} />
          {closed && (
            <p className="invoice-label">
              This invoice is {invoice.status ?? "closed"} and can no longer be changed or deleted.
            </p>
          )}
          {editing && invoice && (
            <InvoiceEditForm
              organizationId={organizationId}
              invoice={invoice}
              onSaved={() => {
                setEditing(false);
                onSaved();
              }}
              onCancel={() => setEditing(false)}
            />
          )}
          <InvoiceOffers
            organizationId={organizationId}
            invoiceId={invoiceId}
            currency={invoice.currency}
            onDecided={() => setRevision((n) => n + 1)}
          />
          {canWrite && (
            <form
              className="workspace-form"
              onSubmit={async (event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                setSent(false);
                const delivered = await submit(async () => {
                  await createApiRequest(path + "/send", {
                    method: "POST",
                    body: JSON.stringify({
                      channel,
                      email: data.get("email") || undefined,
                      channelIdentityId: data.get("identity") || undefined,
                    }),
                  });
                });
                if (delivered) setSent(true);
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
