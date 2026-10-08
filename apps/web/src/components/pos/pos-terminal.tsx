import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  createPosSale,
  getOrganizationContacts,
  getPosCatalog,
  type PosSaleResult,
} from "@/data/pos";
import { getMoneyPolicy, FALLBACK_MONEY_POLICY } from "@/data/money";
import { replayQueuedPosSales } from "@/lib/offline/pos-replay";
import {
  createIndexedDbQueueStore,
  createQueuedPosSale,
  probeQueueStore,
  type PosQueueStore,
} from "@/lib/offline/pos-queue";
import { usePosOfflineStatus } from "@/lib/offline/use-pos-offline";
import { readThrough } from "@/lib/offline/snapshot-store";
import { useLoadedResource } from "@/lib/use-api-resource";
import {
  isStoragePersistent,
  requestDurableStorage,
  type StorageDurability,
} from "@/lib/offline/register-service-worker";
import { isNetworkFailure } from "@/lib/api";
import { PosCart } from "./pos-cart";
import { toCartLineInput, summarizeCart } from "./pos-cart-state";
import { PosCatalog } from "./pos-catalog";
import { PosCheckoutDialog } from "./pos-checkout";
import { PosReceiptDialog } from "./pos-receipt";
import type { PosCartItem, PosPaymentMethod } from "./types/pos.type";

/**
 * The queue is never silently downgraded to memory.
 *
 * An in-memory queue looks like it works and then loses every queued sale on
 * reload — cash in the drawer with no record. The store is proven writable
 * instead, and the till states plainly when it cannot queue.
 */
function resolveQueueStore(): PosQueueStore {
  return createIndexedDbQueueStore();
}

export function PosTerminal({
  organizationId,
  canCheckout,
}: {
  organizationId: string;
  canCheckout: boolean;
}) {
  const [cart, setCart] = useState<PosCartItem[]>([]);
  const [contactId, setContactId] = useState("");
  const [busy, setBusy] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [completed, setCompleted] = useState<PosSaleResult | null>(null);
  const [queuedCount, setQueuedCount] = useState(0);
  const [money, setMoney] = useState(FALLBACK_MONEY_POLICY);

  const queue = useMemo(resolveQueueStore, []);
  const summary = summarizeCart(cart);

  /** A till that cannot queue a sale must say so before a customer is waiting. */
  const storage = useLoadedResource<StorageDurability | "checking">(
    async () => {
      // A real round-trip, not a check that the global exists. Refusing to trade
      // offline is better than accepting money we cannot record.
      if (!(await probeQueueStore(queue, organizationId))) return "unavailable" as const;
      if (await isStoragePersistent()) return "persistent" as const;
      // Worth asking only once the queue is known to work. A refusal is normal
      // on Chrome, which is why the seller is told rather than left guessing.
      return requestDurableStorage();
    },
    [queue, organizationId],
    "checking",
  ).data;

  const flushQueue = useCallback(async () => {
    const result = await replayQueuedPosSales(queue, organizationId, async (entry) => {
      await createPosSale(organizationId, entry.payload as never);
    });
    setQueuedCount(result.remaining);
    if (result.replayed > 0) toast.success(`${result.replayed} queued sale(s) synced.`);
    if (result.failure) toast.error(`Queued sale could not sync: ${result.failure}`);
  }, [queue, organizationId]);

  const { offline, reportFailure, reportSuccess } = usePosOfflineStatus(flushQueue);

  // Read-through: the network is tried first and the last good catalog is kept,
  // so a till opened offline still has products to sell.
  const catalog = useLoadedResource(
    async () => {
      const [products, contacts] = await Promise.all([
        readThrough(`pos:catalog:${organizationId}`, () => getPosCatalog(organizationId)),
        readThrough(`pos:contacts:${organizationId}`, () =>
          getOrganizationContacts(organizationId),
        ),
      ]);
      return { products, contacts };
    },
    [organizationId],
    null,
  );

  // The offline banner follows the load rather than being set inside it, so the
  // report happens exactly once per settled load and never on a stale one.
  useEffect(() => {
    if (catalog.loading) return;
    if (catalog.error) reportFailure();
    else reportSuccess();
  }, [catalog.loading, catalog.error, reportFailure, reportSuccess]);

  const products = catalog.data?.products ?? [];
  const contacts = catalog.data?.contacts ?? [];
  const loading = catalog.loading;
  const error = catalog.error;

  useEffect(() => {
    // Tax and currency must be right even offline, so the last known policy is
    // kept. A stale rate is better than charging a guessed one, and the server
    // re-derives every total regardless.
    void readThrough(`pos:money:${organizationId}`, () => getMoneyPolicy(organizationId))
      .then(setMoney)
      .catch(() => {
        // A till still trades on the fallback policy; the server re-derives.
      });
    void queue.readAll(organizationId).then((entries) => setQueuedCount(entries.length));
  }, [queue, organizationId]);

  function resetSale() {
    setCart([]);
    setCompleted(null);
    setCheckoutOpen(false);
  }

  async function charge(input: {
    discountMinor: number;
    tenderedMinor: number;
    paymentMethod: PosPaymentMethod;
  }) {
    if (!cart.length) return;

    // Minted once per attempt and reused by the replay, so a retried offline sale
    // resolves to the same order instead of charging the customer twice.
    const clientReference = crypto.randomUUID();
    const payload = {
      items: toCartLineInput(cart),
      customerId: contactId || undefined,
      discountMinor: input.discountMinor,
      tenderedMinor: input.tenderedMinor,
      paymentMethod: input.paymentMethod,
      clientReference,
    };

    const enqueue = async () => {
      await queue.put(createQueuedPosSale(organizationId, payload));
      const entries = await queue.readAll(organizationId);
      setQueuedCount(entries.length);
      toast.success("Sale queued — it will sync when you are back online.");
      resetSale();
    };

    if (offline) {
      // Refuse rather than accept cash we cannot record. A sale we cannot store
      // is a sale the books will never show.
      if (storage === "unavailable") {
        toast.error(
          "This device cannot store queued sales. Reconnect, or use a normal browser window.",
        );
        return;
      }
      await enqueue();
      return;
    }

    setBusy(true);
    try {
      const sale = await createPosSale(organizationId, payload);
      setCompleted(sale);
      setCart([]);
      reportSuccess();
    } catch (reason) {
      // A request that fails for network reasons still means the customer is
      // standing at the till waiting. Queue it rather than losing the sale, and
      // re-throw genuine rejections (out of stock, bad request) so they surface.
      if (isNetworkFailure(reason)) {
        reportFailure();
        await enqueue();
        return;
      }
      toast.error(reason instanceof Error ? reason.message : "Could not charge this sale.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <p role="status">Loading the till…</p>;
  if (error)
    return (
      <p role="alert">
        {error}{" "}
        <button type="button" onClick={() => location.reload()}>
          Retry
        </button>
      </p>
    );

  return (
    <div className="pos-terminal">
      {offline && (
        <p className="pos-offline-banner" role="status">
          Offline — sales are queued on this device.
        </p>
      )}
      {queuedCount > 0 && !offline && (
        <p className="pos-offline-banner" role="status">
          {queuedCount} sale(s) waiting to sync.
        </p>
      )}
      {/*
        Best-effort storage still works, but the browser may erase it. That risk
        has to be visible to the seller, because an erased queue is money the
        books never see and nobody else will notice.
      */}
      {storage === "best-effort" && (
        <p className="pos-storage-warning" role="alert">
          Install this app to protect unsynced sales. Until then this browser may erase them — sync
          before closing the till.
        </p>
      )}
      {storage === "unavailable" && (
        <p className="pos-storage-warning" role="alert">
          This browser cannot store sales offline. Online sales are unaffected, but a sale cannot be
          taken while the network is down.
        </p>
      )}

      <div className="pos-terminal-body">
        <div className="pos-terminal-main">
          <PosCatalog
            organizationId={organizationId}
            products={products}
            cart={cart}
            onAdd={setCart}
          />
          {!!contacts.length && (
            <label className="pos-terminal-contact">
              Charge to
              <select value={contactId} onChange={(event) => setContactId(event.target.value)}>
                <option value="">Walk-in customer</option>
                {contacts.map((contact) => (
                  <option key={contact.id} value={contact.id}>
                    {contact.name}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <PosCart
          items={cart}
          subtotalMinor={summary.subtotalMinor}
          // The business's own currency, read once here: a till that formats in
          // naira while selling in dollars shows the customer the wrong figure.
          currency={money.currency}
          onChange={setCart}
          onCheckout={() => canCheckout && setCheckoutOpen(true)}
        />
      </div>

      <PosCheckoutDialog
        open={checkoutOpen}
        items={cart}
        contactId={contactId}
        busy={busy}
        currency={money.currency}
        taxRateBps={money.taxRateBps}
        onOpenChange={setCheckoutOpen}
        onConfirm={charge}
      />
      <PosReceiptDialog
        sale={completed}
        currency={money.currency}
        onClose={resetSale}
        onPrint={() => window.print()}
      />
    </div>
  );
}
