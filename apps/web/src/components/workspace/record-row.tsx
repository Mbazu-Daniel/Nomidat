import { IconArrowUpRight } from "@tabler/icons-react";
import { formatNaira } from "@/data/nomidat";
import type { BusinessRecord, Section } from "./types";

export function RecordRow({
  row,
  section,
  onSelect,
}: {
  row: BusinessRecord;
  section: Section;
  onSelect: (row: BusinessRecord) => void;
}) {
  return (
    <tr>
      <td>
        <button
          className="workspace-record-name"
          onClick={() => {
            onSelect(row);
          }}
        >
          {row.name ?? row.invoiceNumber ?? row.description ?? row.customer ?? "Walk-in sale"}
        </button>
        <small>
          {new Date(row.spentAt ?? row.createdAt).toLocaleDateString("en-NG", {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </small>
      </td>
      <td>
        {section === "inventory" ? (
          <>
            <span>
              {row.stockQuantity} {row.unit}
            </span>
            {row.isActive === false && <span className="workspace-badge">Archived</span>}
            {(row.stockQuantity ?? 0) <= (row.lowStockThreshold ?? 0) && (
              <span className="workspace-badge warning">Low stock</span>
            )}
          </>
        ) : (
          (row.phone ??
          row.customer ??
          row.category ?? <span className="workspace-badge">{row.status ?? "—"}</span>)
        )}
      </td>
      <td>
        {section === "customers" ? (
          <span className="workspace-badge">{row.kind}</span>
        ) : (
          formatNaira((row.priceKobo ?? row.totalKobo ?? row.amountKobo ?? 0) / 100)
        )}
      </td>
      <td>
        <button
          aria-label={`Open ${row.name ?? row.invoiceNumber ?? "record"}`}
          className="workspace-icon-button"
          onClick={() => onSelect(row)}
        >
          <IconArrowUpRight size={18} />
        </button>
      </td>
    </tr>
  );
}
