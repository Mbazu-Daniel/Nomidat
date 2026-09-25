import { formatNaira } from "@/data/nomidat";
import type {
  TransactionCustomerFieldsProps,
  TransactionMoneyFieldsProps,
  TransactionPictureTotalProps,
} from "./types/transaction.type";
export function TransactionCustomerFields({
  contacts,
  invoiceDraft,
  section,
}: TransactionCustomerFieldsProps) {
  return (
    <div className="workspace-form-grid">
      <label>
        Customer
        <select name="customer" defaultValue="" required={Boolean(invoiceDraft)}>
          {invoiceDraft && (
            <option value="" disabled>
              Choose customer
            </option>
          )}
          <option value={invoiceDraft ? "walk-in" : ""}>Walk-in customer</option>
          {contacts.map((contact) => (
            <option key={contact.id} value={contact.id}>
              {contact.name}
            </option>
          ))}
        </select>
        {invoiceDraft?.customerName && (
          <small>Read from picture: {invoiceDraft.customerName}. Select the correct contact.</small>
        )}
      </label>
      {section === "invoices" && (
        <label>
          Due date
          <input name="due" type="date" defaultValue={invoiceDraft?.dueDate ?? ""} />
        </label>
      )}
    </div>
  );
}
export function TransactionMoneyFields({
  tax,
  setTax,
  discount,
  setDiscount,
  total,
  section,
  invoiceDraft,
}: TransactionMoneyFieldsProps) {
  return (
    <div className="workspace-form-grid">
      <label>
        Tax (₦)
        <input
          type="number"
          min="0"
          step="0.01"
          value={tax === null ? "" : tax / 100}
          required
          placeholder="Enter 0 if none"
          onChange={(event) =>
            setTax(event.target.value === "" ? null : Math.round(Number(event.target.value) * 100))
          }
        />
      </label>
      <label>
        Discount (₦)
        <input
          type="number"
          min="0"
          step="0.01"
          value={discount === null ? "" : discount / 100}
          required
          placeholder="Enter 0 if none"
          onChange={(event) =>
            setDiscount(
              event.target.value === "" ? null : Math.round(Number(event.target.value) * 100),
            )
          }
        />
      </label>
      {section === "sales" && (
        <>
          <label>
            Amount collected (₦)
            <input
              name="paid"
              type="number"
              min="0"
              max={Math.max(0, total / 100)}
              step="0.01"
              defaultValue="0"
              required
            />
            <small>Leave at zero for a credit sale.</small>
          </label>
          <label>
            Payment method
            <select name="method">
              <option value="cash">Cash</option>
              <option value="transfer">Bank transfer</option>
              <option value="card">Card</option>
            </select>
          </label>
        </>
      )}
      <label className="workspace-wide">
        Notes
        <textarea name="notes" maxLength={2000} rows={2} defaultValue={invoiceDraft?.notes ?? ""} />
      </label>
    </div>
  );
}
export function TransactionPictureTotal({ invoiceDraft, total }: TransactionPictureTotalProps) {
  if (invoiceDraft?.totalNaira == null) return null;
  return (
    <p>
      Picture total: <strong>{formatNaira(invoiceDraft.totalNaira)}</strong>
      {Math.round(invoiceDraft.totalNaira * 100) !== total &&
        " · This differs from the draft total. Check line items, tax and discount."}
    </p>
  );
}
