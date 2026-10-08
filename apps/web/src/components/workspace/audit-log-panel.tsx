import { getAuditLog, getAuditSummary, type AuditEntry } from "@/data/engagement";
import { useAsyncResource } from "@/lib/use-api-resource";
import { useCallback, useState } from "react";
import { TablePagination } from "@/components/workspace/table-pagination";
import { ACTION_LABELS } from "./audit-labels";

function when(value: string) {
  return new Date(value).toLocaleString();
}

function Detail({ entry }: { entry: AuditEntry }) {
  const metadata = entry.metadata;
  if (!metadata || Object.keys(metadata).length === 0) return <span>—</span>;
  return <code className="workspace-audit-metadata">{JSON.stringify(metadata)}</code>;
}

/**
 * The activity trail. It exists so a seller can answer "who changed this, and
 * when" without asking anyone — so it is read access, not an owner-only log.
 */
export function AuditLogPanel({ organizationId }: { organizationId: string }) {
  const [offset, setOffset] = useState(0);
  const limit = 50;
  // Stable identity, because the hook refetches whenever the loader changes.
  const load = useCallback(
    () => getAuditLog(organizationId, offset, limit),
    [organizationId, offset],
  );
  const page = useAsyncResource(load, `${organizationId}:${offset}`, { entries: [], total: 0 }, 0);
  const summary = useAsyncResource(getAuditSummary, organizationId, [], 0);

  return (
    <section className="workspace-card workspace-records">
      <div className="workspace-table-toolbar">
        <h2>
          Activity <span className="workspace-count">{page.data.total}</span>
        </h2>
      </div>

      {!!summary.data.length && (
        <ul className="inventory-chip-list workspace-audit-summary">
          {summary.data.slice(0, 8).map((row) => (
            <li key={row.action} className="inventory-chip">
              {ACTION_LABELS[row.action] ?? row.action}
              <span className="inventory-chip-meta">{row.value}</span>
            </li>
          ))}
        </ul>
      )}

      {page.error && <p className="workspace-error">{page.error}</p>}

      <table className="inventory-plain-table">
        <thead>
          <tr>
            <th>When</th>
            <th>Action</th>
            <th>Who</th>
            <th>Record</th>
            <th>Detail</th>
          </tr>
        </thead>
        <tbody>
          {page.data.entries.map((entry) => (
            <tr key={entry.id}>
              <td>{when(entry.createdAt)}</td>
              <td>{ACTION_LABELS[entry.action] ?? entry.action}</td>
              <td>{entry.actorEmail ?? "—"}</td>
              <td className="inventory-code">{entry.entityId ?? "—"}</td>
              <td>
                <Detail entry={entry} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {!page.loading && !page.data.entries.length && (
        <p className="inventory-empty">Nothing has happened here yet.</p>
      )}

      <TablePagination
        page={offset / limit + 1}
        count={page.data.entries.length}
        loading={page.loading}
        hasNext={page.data.entries.length === limit}
        pageSize={limit}
        onPageChange={(next) => setOffset((next - 1) * limit)}
      />
    </section>
  );
}
