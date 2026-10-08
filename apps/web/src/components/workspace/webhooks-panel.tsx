import { createWebhook, deleteWebhook, getWebhooks, type WebhookRow } from "@/data/engagement";
import { useAsyncResource } from "@/lib/use-api-resource";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

/**
 * Mirrors the API's allow-list, so an unsupported event is never submitted.
 * Only events the API really emits: a tenant subscribing to something no code
 * produces would wait forever for a delivery that can never come.
 */
const EVENTS = ["invoice.created", "payment.received", "sale.created"] as const;

function delivery(row: WebhookRow) {
  if (row.lastDeliveryAt === null) return "Never called";
  const code = row.lastStatusCode ?? 0;
  const failed = code >= 400 || row.consecutiveFailures > 0;
  return `${failed ? "Failing" : "Last call"} ${new Date(row.lastDeliveryAt).toLocaleString()}${
    code ? ` · HTTP ${code}` : ""
  }`;
}

export function WebhooksPanel({ organizationId }: { organizationId: string }) {
  const [revision, setRevision] = useState(0);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [secret, setSecret] = useState("");
  const webhooks = useAsyncResource(getWebhooks, organizationId, [], revision);

  async function subscribe(form: HTMLFormElement) {
    const data = new FormData(form);
    const events = EVENTS.filter((event) => data.get(event) === "on");
    const url = String(data.get("url") ?? "").trim();

    setBusyId("create");
    setError("");
    try {
      const created = await createWebhook(organizationId, { url, events: [...events] });
      // Shown once and never retrievable again, so it is surfaced immediately
      // rather than left for the seller to discover they never received it.
      setSecret(created.secret);
      setRevision((n) => n + 1);
      toast.success("Endpoint subscribed.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not subscribe that endpoint");
    } finally {
      setBusyId("");
    }
  }

  async function remove(row: WebhookRow) {
    if (window.confirm(`Stop sending events to ${row.url}?`)) {
      setBusyId(row.id);
      try {
        await deleteWebhook(organizationId, row.id);
        setRevision((n) => n + 1);
        toast.success("Endpoint removed.");
      } catch (reason) {
        toast.error(reason instanceof Error ? reason.message : "Could not remove that endpoint");
      } finally {
        setBusyId("");
      }
    }
  }

  return (
    <>
      <section className="workspace-card">
        <h2>Outbound webhooks</h2>
        <p className="workspace-readonly">
          Send an HTTPS endpoint a signed payload whenever something happens in your business.
        </p>

        {secret && (
          <div className="workspace-secret" role="status">
            <strong>Copy this signing secret now.</strong>
            <p>It is shown once and cannot be retrieved again.</p>
            <code>{secret}</code>
            <Button type="button" size="sm" variant="ghost" onClick={() => setSecret("")}>
              I have saved it
            </Button>
          </div>
        )}

        {error && <p className="workspace-error">{error}</p>}

        <form className="workspace-form" onSubmit={(event) => void subscribe(event.currentTarget)}>
          <label>
            Endpoint URL
            <input
              name="url"
              type="url"
              required
              maxLength={2000}
              placeholder="https://example.com/hooks/nomidat"
            />
          </label>
          <fieldset className="workspace-webhook-events">
            <legend>Events</legend>
            {EVENTS.map((event) => (
              <label key={event}>
                <input type="checkbox" name={event} defaultChecked={event === "sale.created"} />
                {event}
              </label>
            ))}
          </fieldset>
          <button className="workspace-primary" disabled={busyId === "create"}>
            Subscribe endpoint
          </button>
        </form>
      </section>

      <section className="workspace-card workspace-records">
        <h2>Your endpoints</h2>
        {webhooks.error && <p className="workspace-error">{webhooks.error}</p>}

        <table className="inventory-plain-table">
          <thead>
            <tr>
              <th>Endpoint</th>
              <th>Events</th>
              <th>Delivery</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {webhooks.data.map((row) => (
              <tr key={row.id}>
                <td className="inventory-code">{row.url}</td>
                <td>{row.events}</td>
                <td>{delivery(row)}</td>
                <td>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={busyId === row.id}
                    onClick={() => void remove(row)}
                  >
                    Remove
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!webhooks.loading && !webhooks.data.length && (
          <p className="inventory-empty">No endpoints subscribed.</p>
        )}
      </section>
    </>
  );
}
