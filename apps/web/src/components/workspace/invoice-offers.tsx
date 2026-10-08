import { decideInvoiceOffer, getInvoiceOffers, type InvoiceOffer } from "@/data/invoices";
import { formatMoney } from "@/lib/money";
import { useAsyncResource } from "@/lib/use-api-resource";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

/**
 * Counter-offers a customer has made against this invoice.
 *
 * Accepting rewrites the invoice total, so it is deliberately a separate
 * deliberate action rather than something that happens by opening the page.
 */
export function InvoiceOffers({
  organizationId,
  invoiceId,
  currency,
  onDecided,
}: {
  organizationId: string;
  invoiceId: string;
  currency: string;
  onDecided: () => void;
}) {
  const [revision, setRevision] = useState(0);
  const [busyId, setBusyId] = useState("");
  // Stable identity, because the hook refetches whenever the loader changes.
  const load = useCallback(
    () => getInvoiceOffers(organizationId, invoiceId),
    [organizationId, invoiceId],
  );
  const offers = useAsyncResource<InvoiceOffer[]>(load, invoiceId, [], revision);

  async function decide(offer: InvoiceOffer, decision: "accepted" | "declined") {
    const label = decision === "accepted" ? "accept" : "decline";
    if (
      decision === "accepted" &&
      !window.confirm(
        `Accept ${formatMoney(offer.proposedTotalMinor, currency)}? This rewrites the invoice total.`,
      )
    ) {
      return;
    }
    setBusyId(offer.id);
    try {
      await decideInvoiceOffer(organizationId, invoiceId, offer.id, decision);
      setRevision((n) => n + 1);
      onDecided();
      toast.success(
        decision === "accepted"
          ? "Offer accepted. The invoice total has changed."
          : "Offer declined.",
      );
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : `Could not ${label} that offer`);
    } finally {
      setBusyId("");
    }
  }

  if (offers.error) return null;
  if (!offers.data.length) return null;

  return (
    <section className="workspace-card workspace-offers">
      <h3>Counter-offers</h3>
      <ul className="workspace-inbox-list">
        {offers.data.map((offer) => (
          <li key={offer.id} className="workspace-inbox-item">
            <div>
              <strong>{formatMoney(offer.proposedTotalMinor, currency)}</strong>
              {offer.message && <p>{offer.message}</p>}
              <span className="workspace-inbox-meta">
                {new Date(offer.createdAt).toLocaleString()} ·{" "}
                {offer.status === "pending" ? "Awaiting your answer" : offer.status}
              </span>
            </div>
            {offer.status === "pending" && (
              <span className="workspace-row-actions">
                <Button
                  type="button"
                  size="sm"
                  disabled={busyId === offer.id}
                  onClick={() => void decide(offer, "accepted")}
                >
                  Accept
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={busyId === offer.id}
                  onClick={() => void decide(offer, "declined")}
                >
                  Decline
                </Button>
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
