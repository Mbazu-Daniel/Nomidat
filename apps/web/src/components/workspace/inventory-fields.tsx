import type { FormProps } from "./types";
import { useCurrency } from "@/lib/currency-context";

export function ProductFields(props: FormProps) {
  const draft = props.pictureItems?.[0];
  // The prices below are stored per the business's currency, so the label names it
  // instead of assuming naira. The scale is applied on submit, by
  // `recordFormDefinition`, which reads the same currency.
  const currency = useCurrency();
  return (
    <>
      <label>
        Product name
        <input
          name="name"
          defaultValue={draft?.name ?? ""}
          required
          maxLength={160}
          placeholder="e.g. Cement, 50 kg"
          autoFocus
        />
      </label>
      <label>
        <span className="workspace-field-heading">
          SKU <small>Optional</small>
        </span>
        <input name="sku" maxLength={80} placeholder="e.g. CEM-50" />
      </label>
      <label>
        Cost price ({currency})
        <input
          name="cost"
          type="number"
          min="0"
          max="20000000"
          step="0.01"
          defaultValue="0"
          required
        />
      </label>
      <label>
        Description <small>Optional</small>
        <input name="description" maxLength={4000} />
      </label>
      <label>
        Selling price ({currency})
        <input
          defaultValue={draft?.unitPriceNaira ?? ""}
          name="price"
          type="number"
          min="0"
          max="20000000"
          step="0.01"
          required
        />
      </label>
      <label>
        Unit
        <input name="unit" defaultValue={draft?.unit ?? "units"} required maxLength={40} />
      </label>
      <label>
        Stock on hand
        <input
          name="stock"
          type="number"
          min="0"
          step="1"
          defaultValue={draft ? (draft.quantity ?? "") : "0"}
          required
        />
      </label>
      <label>
        Low-stock alert at
        <input name="threshold" type="number" min="0" step="1" defaultValue="5" required />
      </label>
    </>
  );
}
