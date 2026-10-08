import { useState } from "react";
import { IconArrowUpRight, IconFileInvoice, IconShare2 } from "@tabler/icons-react";
import { formatMoney } from "@/lib/money";
import { useCurrency } from "@/lib/currency-context";
import { InvoiceShareControl } from "./invoice-share-control";
import type { InvoiceRegisterProps } from "./types";

export function InvoiceRegister({ organizationId, rows, onSelect }: InvoiceRegisterProps) {
  // The register lists what customers owe, in the business's own currency.
  const currency = useCurrency();
  const [sharingId, setSharingId] = useState<string | null>(null);

  return (
    <div className="workspace-table-scroll invoice-register">
      <table>
        <thead>
          <tr>
            <th>Invoice / customer</th>
            <th>Issued</th>
            <th>Due date</th>
            <th>Status</th>
            <th className="invoice-number">Amount</th>
            <th>
              <span className="sr-only">Open invoice</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>
                <div className="invoice-register-identity">
                  <span className="invoice-file-icon">
                    <IconFileInvoice size={21} stroke={1.5} />
                  </span>
                  <div>
                    <button className="workspace-record-name" onClick={() => onSelect(row)}>
                      {row.invoiceNumber}
                    </button>
                    <small>{row.customer ?? "Walk-in customer"}</small>
                  </div>
                </div>
              </td>
              <td>
                {new Date(row.createdAt).toLocaleDateString("en-NG", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </td>
              <td>
                {row.dueDate
                  ? new Date(row.dueDate).toLocaleDateString("en-NG", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  : "On receipt"}
              </td>
              <td>
                <span className="invoice-status">{row.status ?? "draft"}</span>
              </td>
              <td className="invoice-number">
                <strong>{formatMoney(row.totalMinor ?? 0, currency)}</strong>
                <small>NGN</small>
              </td>
              <td>
                <div className="invoice-register-actions">
                  <button
                    className="workspace-icon-button"
                    aria-label={`Share invoice ${row.invoiceNumber}`}
                    aria-expanded={sharingId === row.id}
                    onClick={() => setSharingId(sharingId === row.id ? null : row.id)}
                  >
                    <IconShare2 size={18} />
                  </button>
                  <button
                    className="workspace-icon-button"
                    aria-label={`Open invoice ${row.invoiceNumber}`}
                    onClick={() => onSelect(row)}
                  >
                    <IconArrowUpRight size={18} />
                  </button>
                </div>
                {sharingId === row.id && (
                  <InvoiceShareControl
                    organizationId={organizationId}
                    invoiceId={row.id}
                    invoiceNumber={row.invoiceNumber ?? row.id}
                  />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
