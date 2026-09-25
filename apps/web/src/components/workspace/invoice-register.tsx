import { IconArrowUpRight, IconFileInvoice } from "@tabler/icons-react";
import { formatInvoiceMoney } from "./invoice-format";
import type { InvoiceRegisterProps } from "./types";

export function InvoiceRegister({ rows, onSelect }: InvoiceRegisterProps) {
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
                <strong>{formatInvoiceMoney(row.totalKobo ?? 0)}</strong>
                <small>NGN</small>
              </td>
              <td>
                <button
                  className="workspace-icon-button"
                  aria-label={`Open invoice ${row.invoiceNumber}`}
                  onClick={() => onSelect(row)}
                >
                  <IconArrowUpRight size={18} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
