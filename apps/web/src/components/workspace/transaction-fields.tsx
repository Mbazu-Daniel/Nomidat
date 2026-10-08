import { useCurrency } from "@/lib/currency-context";
import { formatMoney, minorToDecimalInput, parseMoneyToMinor } from "@/lib/money";
import type {
  TransactionCustomerFieldsProps,
  TransactionMoneyFieldsProps,
  TransactionPictureTotalProps,
} from "./types/transaction.type";
import { draftMoney } from "./transaction-data";
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
  // Read from the business, not assumed: the seller types an amount in their own
  // currency, and a fixed hundredth would misread a currency that has none.
  const currency = useCurrency();
  // The smallest amount the currency can hold — 0.01 for naira, 1 for yen.
  const step = Number(minorToDecimalInput(1, currency));
  return (
    <div className="workspace-form-grid">
      <label>
        Tax ({currency})
        <input
          type="number"
          min="0"
          step={step}
          value={tax === null ? "" : minorToDecimalInput(tax, currency)}
          required
          placeholder="Enter 0 if none"
          onChange={(event) =>
            setTax(
              event.target.value === "" ? null : parseMoneyToMinor(event.target.value, currency),
            )
          }
        />
      </label>
      <label>
        Discount ({currency})
        <input
          type="number"
          min="0"
          step={step}
          value={discount === null ? "" : minorToDecimalInput(discount, currency)}
          required
          placeholder="Enter 0 if none"
          onChange={(event) =>
            setDiscount(
              event.target.value === "" ? null : parseMoneyToMinor(event.target.value, currency),
            )
          }
        />
      </label>
      {section === "sales" && (
        <>
          <label>
            Amount collected ({currency})
            <input
              name="paid"
              type="number"
              min="0"
              max={Number(minorToDecimalInput(Math.max(0, total), currency))}
              step={step}
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
  const currency = useCurrency();
  if (invoiceDraft?.totalNaira == null) return null;
  // The picture's total arrives in major units, so it goes through the same
  // conversion as the line items before it is rendered as minor units. Rendered
  // straight it would read a thousand-naira receipt as ten.
  const pictureMinor = draftMoney(invoiceDraft.totalNaira) ?? 0;
  return (
    <p>
      Picture total: <strong>{formatMoney(pictureMinor, currency)}</strong>
      {pictureMinor !== total &&
        " · This differs from the draft total. Check line items, tax and discount."}
    </p>
  );
}
