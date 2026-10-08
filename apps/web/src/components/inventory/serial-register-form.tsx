import { getProducts, type Product } from "@/data/catalog";
import { getAvailableSerials, registerSerials } from "@/data/serials";
import { useAsyncResource } from "@/lib/use-api-resource";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ProductOptionSelect } from "./product-option-select";

/**
 * One code per line: an IMEI pasted as a single blob cannot be checked against
 * what is already registered, so the seller is asked for the list they mean.
 */
export function SerialRegisterForm({
  organizationId,
  onCreated,
}: {
  organizationId: string;
  onCreated: () => void;
}) {
  const products = useAsyncResource<Product[]>(getProducts, organizationId, [], 0);
  const [productId, setProductId] = useState("");
  const [variantId, setVariantId] = useState("");
  const [codes, setCodes] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const parsed = codes
    .split(/[\n,]/)
    .map((code) => code.trim())
    .filter(Boolean);
  const duplicates = parsed.length !== new Set(parsed).size;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!productId) return;

    // Checked against the registered set first, because the unique index would
    // otherwise fail the whole batch on the first clash and lose the rest.
    try {
      const existing = await getAvailableSerials(organizationId, productId);
      const known = new Set(existing.map((serial) => serial.code));
      const clash = parsed.filter((code) => known.has(code));
      if (clash.length) {
        setError(`Already in stock: ${clash.join(", ")}.`);
        return;
      }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not check existing units.");
      return;
    }

    setError("");
    setBusy(true);
    try {
      await registerSerials(organizationId, {
        productId,
        variantId: variantId || undefined,
        codes: parsed,
      });
      setCodes("");
      onCreated();
      toast.success(`${parsed.length} unit(s) registered and booked in.`);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not register those units.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="inventory-create-form inventory-operation-form" onSubmit={submit}>
      <ProductOptionSelect
        organizationId={organizationId}
        products={products.data}
        productId={productId}
        variantId={variantId}
        onProductChange={(value) => {
          setProductId(value);
          setVariantId("");
        }}
        onVariantChange={setVariantId}
      />
      <div>
        <label htmlFor="serial-codes">Codes, one per line</label>
        <textarea
          id="serial-codes"
          rows={4}
          value={codes}
          onChange={(event) => setCodes(event.target.value)}
          placeholder={"356938035643809\n356938035643810"}
          required
        />
      </div>

      {duplicates && <p className="workspace-error">The same code appears more than once.</p>}
      {error && <p className="workspace-error">{error}</p>}

      <Button type="submit" disabled={busy || !productId || !parsed.length}>
        {busy ? "Registering…" : `Register ${parsed.length || ""} unit(s)`}
      </Button>
    </form>
  );
}
