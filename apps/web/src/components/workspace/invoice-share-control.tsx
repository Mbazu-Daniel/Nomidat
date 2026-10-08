import { useState } from "react";
import { revokeInvoiceShare, shareInvoice } from "@/data/invoices";
import { Button } from "@/components/ui/button";
import "./invoice-share.css";

/**
 * Issues a share link on demand and shows the resulting URL. The seller can only
 * ever see the link after asking for it, so no code is generated until this runs
 * and the previous one is dead the moment a new one is issued.
 */
export function InvoiceShareControl({
  organizationId,
  invoiceId,
  invoiceNumber,
}: {
  organizationId: string;
  invoiceId: string;
  invoiceNumber: string;
}) {
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function issue() {
    setBusy(true);
    setError("");
    try {
      const result = await shareInvoice(organizationId, invoiceId);
      setLink(`${window.location.origin}/invoice/${result.shareCode}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not create a share link.");
      setLink("");
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    setBusy(true);
    setError("");
    try {
      await revokeInvoiceShare(organizationId, invoiceId);
      setLink("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not revoke the link.");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    await navigator.clipboard.writeText(link);
  }

  return (
    <div className="invoice-share">
      {link ? (
        <>
          <input className="invoice-share-link" readOnly value={link} aria-label="Share link" />
          <Button type="button" variant="outline" onClick={copy} disabled={busy}>
            Copy
          </Button>
          <Button type="button" variant="ghost" onClick={revoke} disabled={busy}>
            Revoke
          </Button>
        </>
      ) : (
        <Button type="button" variant="outline" onClick={issue} disabled={busy}>
          {busy ? "Working…" : "Create share link"}
        </Button>
      )}
      {error && (
        <p className="invoice-share-error" role="alert">
          {error}
        </p>
      )}
      <small className="invoice-share-hint">
        Anyone with this link can read invoice {invoiceNumber} until you revoke or replace it.
      </small>
    </div>
  );
}
