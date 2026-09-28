import type { RecordTableProps, RecordToolbarProps } from "./types/workspace.type";
import { matchesRecord } from "./record-search";
import { useApiResource } from "@/lib/use-api-resource";
import { recordMetadata as metadata } from "./record-metadata";
import { useState } from "react";
import { IconPlus, IconSearch, IconUpload } from "@tabler/icons-react";
import { TablePagination } from "./table-pagination";
import { SalesRegister } from "./sales-register";
import { InvoiceRegister } from "./invoice-register";
import { RecordRow } from "./record-row";
import { PictureImport } from "./picture-import";
import { RecordForm } from "./record-form";
import { RecordDetail } from "./record-detail";
import type { BusinessRecord, Section } from "./types";

export function RecordsPanel({
  organizationId,
  section,
  canWrite,
}: {
  organizationId: string;
  section: Exclude<Section, "overview" | "chat" | "settings" | "channels" | "reports">;
  canWrite: boolean;
}) {
  const meta = metadata[section];
  const [offset, setOffset] = useState(0);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [uploading, setUploading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<BusinessRecord | null>(null);
  const [version, setVersion] = useState(0);
  const {
    data: rows,
    loading,
    error,
  } = useApiResource<BusinessRecord[]>(
    `/organizations/${organizationId}/${meta.resource}?limit=50&offset=${offset}`,
    [],
    version,
  );

  const filtered = rows.filter((row) => matchesRecord(row, query, filter));
  function saved() {
    setCreating(false);
    setUploading(false);
    setSelected(null);
    setVersion((current) => current + 1);
  }
  function renderRecordActions() {
    return (
      <div className="workspace-actions">
        {section !== "customers" && (
          <button
            className="workspace-secondary"
            onClick={() => {
              setUploading(true);
              setCreating(false);
              setSelected(null);
            }}
          >
            <IconUpload size={18} aria-hidden="true" />
            Upload picture
          </button>
        )}
        <button
          className="workspace-primary"
          onClick={() => {
            setUploading(false);
            setCreating(true);
            setSelected(null);
          }}
        >
          <IconPlus size={18} />
          {meta.action}
        </button>
      </div>
    );
  }
  return (
    <>
      <div className="workspace-heading">
        <div>
          <h1>{meta.title}</h1>
          <p>{meta.subtitle}</p>
        </div>
        {canWrite && renderRecordActions()}
      </div>
      {!canWrite && (
        <p className="workspace-readonly">
          View access · An owner, admin or manager can add and update records.
        </p>
      )}
      {uploading && section !== "customers" && (
        <PictureImport
          organizationId={organizationId}
          section={section}
          onSaved={saved}
          onCancel={saved}
        />
      )}
      {creating && (
        <RecordForm
          organizationId={organizationId}
          section={section}
          onSaved={saved}
          onCancel={() => setCreating(false)}
        />
      )}
      {selected && (
        <RecordDetail
          key={selected.id}
          organizationId={organizationId}
          section={section}
          record={selected}
          canWrite={canWrite}
          onSaved={saved}
          onClose={() => setSelected(null)}
        />
      )}
      <section className="workspace-card workspace-records">
        <RecordToolbar
          section={section}
          count={rows.length}
          query={query}
          filter={filter}
          setQuery={setQuery}
          setFilter={setFilter}
        />
        <RecordTable
          section={section}
          rows={filtered}
          query={query}
          error={error}
          loading={loading}
          retry={() => setVersion((current) => current + 1)}
          onSelect={(record) => {
            setUploading(false);
            setSelected(record);
            setCreating(false);
          }}
        />
        <TablePagination
          page={offset / 50 + 1}
          count={filtered.length}
          loading={loading}
          hasNext={rows.length === 50}
          onPageChange={(page) => {
            setSelected(null);
            setOffset((page - 1) * 50);
          }}
        />
      </section>
    </>
  );
}

function RecordTable({ section, rows, query, error, loading, retry, onSelect }: RecordTableProps) {
  const meta = metadata[section];
  const Register = section === "sales" ? SalesRegister : InvoiceRegister;
  function renderEmptyState() {
    return (
      <div className="workspace-empty">
        <span className="workspace-empty-symbol">{query ? "⌕" : "+"}</span>
        <h3>{query ? "No matching records" : `Your ${meta.title.toLowerCase()} start here`}</h3>
        <p>
          {query
            ? "Try another name or clear your filters."
            : `Use “${meta.action}” to create your first record.`}
        </p>
      </div>
    );
  }

  function renderTable() {
    if (error)
      return (
        <div className="workspace-error" role="alert">
          {error}
          <button onClick={() => retry()}>Try again</button>
        </div>
      );
    if (loading)
      return (
        <div className="workspace-empty" role="status">
          Loading {meta.title.toLowerCase()}…
        </div>
      );
    if (rows.length === 0) return renderEmptyState();

    if (section === "invoices" || section === "sales")
      return <Register rows={rows} onSelect={onSelect} />;
    return (
      <div className="workspace-table-scroll">
        <table>
          <thead>
            <tr>
              <th>
                {section === "inventory"
                  ? "Product"
                  : section === "customers"
                    ? "Contact"
                    : "Record"}
              </th>
              <th>{section === "inventory" ? "Stock on hand" : "Details"}</th>
              <th>
                {section === "inventory"
                  ? "Unit price"
                  : section === "customers"
                    ? "Type"
                    : "Amount"}
              </th>
              <th>
                <span className="sr-only">View details</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <RecordRow key={row.id} row={row} section={section} onSelect={onSelect} />
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return renderTable();
}

function RecordToolbar({ section, count, query, filter, setQuery, setFilter }: RecordToolbarProps) {
  const meta = metadata[section];
  return (
    <div className="workspace-table-toolbar">
      <div>
        <h2>
          All {meta.title.toLowerCase()} <span className="workspace-count">{count}</span>
        </h2>
      </div>
      <div className="workspace-table-filters">
        <label className="workspace-search">
          <IconSearch size={17} />
          <input
            aria-label={`Search ${meta.title.toLowerCase()}`}
            placeholder="Search this page…"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        {(section === "inventory" || section === "customers") && (
          <select
            aria-label="Filter records"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          >
            <option value="all">All records</option>
            <option value={section === "inventory" ? "low" : "lead"}>
              {section === "inventory" ? "Low stock" : "Leads"}
            </option>
          </select>
        )}
      </div>
    </div>
  );
}
