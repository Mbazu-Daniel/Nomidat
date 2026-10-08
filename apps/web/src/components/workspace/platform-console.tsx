import {
  getPlatformOrganizationActivity,
  getPlatformOrganizations,
  getPlatformOverview,
  type PlatformOrganization,
  type PlatformOrganizationActivity,
} from "@/data/platform";
import { formatMoney } from "@/lib/money";
import { useAsyncResource } from "@/lib/use-api-resource";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/nomidat/stat-card";

/**
 * The operator's view across every tenant.
 *
 * Counts only. A platform screen that can list a tenant's customers or invoices
 * is one forgotten check away from being a breach, so the API does not offer it
 * and neither does this.
 */
export function PlatformConsole() {
  const overview = useAsyncResource(getPlatformOverview, "overview", null, 0);
  const organizations = useAsyncResource(getPlatformOrganizations, "organizations", [], 0);

  // The API decides who may see this, from the caller's email. A refusal is the
  // expected answer for everyone else, so it is stated rather than shown as an
  // error the visitor is meant to act on.
  if (overview.error) {
    return (
      <section className="workspace-page">
        <div className="workspace-heading">
          <div>
            <h1>Platform</h1>
            <p>Cross-tenant totals for the Nomidat operator.</p>
          </div>
        </div>
        <p className="workspace-readonly">{overview.error}</p>
      </section>
    );
  }

  const totals = overview.data;

  return (
    <section className="workspace-page">
      <div className="workspace-heading">
        <div>
          <h1>Platform</h1>
          <p>Cross-tenant totals for the Nomidat operator.</p>
        </div>
      </div>

      {totals && (
        <div className="workspace-stats">
          <StatCard label="Businesses" value={String(totals.organizationCount)} />
          <StatCard label="Users" value={String(totals.userCount)} />
          <StatCard label="Orders" value={String(totals.orderCount)} />
        </div>
      )}

      {!!totals?.collectedByCurrency.length && (
        <div className="workspace-card">
          <h2>Collected</h2>
          <ul className="inventory-chip-list">
            {totals.collectedByCurrency.map((row) => (
              <li key={row.currency} className="inventory-chip">
                {formatMoney(row.totalMinor, row.currency)}
                <span className="inventory-chip-meta">{row.currency}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="workspace-card workspace-records">
        <h2>Businesses</h2>
        {organizations.error && <p className="workspace-error">{organizations.error}</p>}
        <TenantTable organizations={organizations.data} />
      </div>
    </section>
  );
}

function TenantTable({ organizations }: { organizations: PlatformOrganization[] }) {
  const [selected, setSelected] = useState<string>("");
  const activity = useAsyncResource(getPlatformOrganizationActivity, selected || null, null, 0);

  return (
    <>
      <table className="inventory-plain-table">
        <thead>
          <tr>
            <th>Business</th>
            <th>Handle</th>
            <th>Currency</th>
            <th>Joined</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {organizations.map((row) => (
            <tr key={row.id}>
              <td>{row.name}</td>
              <td className="inventory-code">{row.slug ?? "—"}</td>
              <td>{row.currency}</td>
              <td>{new Date(row.createdAt).toLocaleDateString()}</td>
              <td>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setSelected(selected === row.id ? "" : row.id)}
                >
                  {selected === row.id ? "Hide" : "View"}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {!organizations.length && <p className="inventory-empty">No businesses yet.</p>}

      {/* Looking inside a tenant is logged by the API as a deliberate act. */}
      {selected && <TenantActivity activity={activity.data} error={activity.error} />}
    </>
  );
}

function TenantActivity({
  activity,
  error,
}: {
  activity: PlatformOrganizationActivity | null;
  error: string;
}) {
  if (error) return <p className="workspace-error">{error}</p>;
  if (!activity) return <p className="inventory-empty">Loading…</p>;

  return (
    <div className="workspace-card workspace-platform-detail">
      <h3>{activity.name ?? activity.organizationId}</h3>
      <div className="workspace-stats">
        <StatCard label="Orders" value={String(activity.orderCount)} />
        <StatCard label="Payments" value={String(activity.paymentCount)} />
      </div>
      <p className="workspace-readonly">
        This lookup is written to that business&apos;s own activity trail.
      </p>
    </div>
  );
}
