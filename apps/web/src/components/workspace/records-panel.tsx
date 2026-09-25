import { recordMetadata as metadata } from "./record-metadata";
import { useEffect, useState } from "react";
import { IconPlus, IconSearch, IconUpload } from "@tabler/icons-react";
import { createApiRequest } from "@/lib/api";
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
  const Register = section === "sales" ? SalesRegister : InvoiceRegister;
  const [offset, setOffset] = useState(0);
  const [rows, setRows] = useState<BusinessRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [uploading, setUploading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<BusinessRecord | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    void createApiRequest<BusinessRecord[]>(
      `/organizations/${organizationId}/${meta.resource}?limit=50&offset=${offset}`,
    )
      .then((result) => {
        if (!cancelled) setRows(result);
      })
      .catch((reason: Error) => {
        if (!cancelled) setError(reason.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [organizationId, meta.resource, version, offset]);
  const filtered = rows.filter((row) => {
    const text = [
      row.saleReference,
      row.saleItems?.map((item) => item.productName).join(" "),
      row.name,
      row.customer,
      row.description,
      row.invoiceNumber,
      row.phone,
    ].join(" ");
    if (!text.toLowerCase().includes(query.toLowerCase())) return false;
    if (filter === "low") return (row.stockQuantity ?? 0) <= (row.lowStockThreshold ?? 0);
    return filter !== "lead" || row.kind === "lead";
  });
  function saved() {
    setCreating(false);
    setUploading(false);
    setSelected(null);
    setVersion((current) => current + 1);
  }
  function renderTable() {
    if (error)
      return (
        <div className="workspace-error" role="alert">
          {error}
          <button onClick={() => setVersion((current) => current + 1)}>Try again</button>
        </div>
      );
    if (loading)
      return (
        <div className="workspace-empty" role="status">
          Loading {meta.title.toLowerCase()}…
        </div>
      );
    if (filtered.length === 0)
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
    if (section === "invoices" || section === "sales")
      return (
        <Register
          rows={filtered}
          onSelect={(record) => {
            setUploading(false);
            setSelected(record);
            setCreating(false);
          }}
        />
      );
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
            {filtered.map((row) => (
              <RecordRow
                key={row.id}
                row={row}
                section={section}
                onSelect={(record) => {
                  setUploading(false);
                  setSelected(record);
                  setCreating(false);
                }}
              />
            ))}
          </tbody>
        </table>
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
        {canWrite && (
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
        )}
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
        <div className="workspace-table-toolbar">
          <div>
            <h2>
              All {meta.title.toLowerCase()} <span className="workspace-count">{rows.length}</span>
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
        {renderTable()}
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
