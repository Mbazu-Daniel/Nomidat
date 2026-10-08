import {
  createCategory,
  createSupplier,
  createUnit,
  getCategories,
  getSuppliers,
  getUnitConversions,
  getUnits,
  type ProductCategory,
  type Supplier,
  type UnitConversion,
  type UnitOfMeasure,
} from "@/data/catalog";
import { useAsyncResource } from "@/lib/use-api-resource";
import { CatalogRowActions } from "./catalog-row-actions";
import { UnitConversionForm } from "./unit-conversion-form";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type Tab = "categories" | "units" | "conversions" | "suppliers";

const TABS: { id: Tab; label: string }[] = [
  { id: "categories", label: "Categories" },
  { id: "units", label: "Units of measure" },
  { id: "conversions", label: "Conversions" },
  { id: "suppliers", label: "Suppliers" },
];

/** The organising layer: how products are grouped, measured and supplied. */
export function CatalogPanel({
  organizationId,
  canWrite,
}: {
  organizationId: string;
  canWrite: boolean;
}) {
  const [tab, setTab] = useState<Tab>("categories");
  const [revision, setRevision] = useState(0);
  const categories = useAsyncResource<ProductCategory[]>(
    getCategories,
    tab === "categories" ? organizationId : null,
    [],
    revision,
  );
  const units = useAsyncResource<UnitOfMeasure[]>(
    getUnits,
    tab === "units" ? organizationId : null,
    [],
    revision,
  );
  const suppliers = useAsyncResource<Supplier[]>(
    getSuppliers,
    tab === "suppliers" ? organizationId : null,
    [],
    revision,
  );
  const conversions = useAsyncResource<UnitConversion[]>(
    getUnitConversions,
    tab === "conversions" ? organizationId : null,
    [],
    revision,
  );
  // Units are needed to name the pairs a conversion connects, and to label them
  // afterwards, whichever tab is open.
  const allUnits = useAsyncResource<UnitOfMeasure[]>(getUnits, organizationId, [], revision);

  const active =
    tab === "categories"
      ? categories
      : tab === "units"
        ? units
        : tab === "conversions"
          ? conversions
          : suppliers;

  function unitLabel(id: string) {
    return allUnits.data.find((unit) => unit.id === id)?.code ?? "—";
  }

  return (
    <section className="inventory-panel">
      <div className="inventory-subtabs" role="tablist" aria-label="Catalog sections">
        {TABS.map((option) => (
          <button
            key={option.id}
            type="button"
            role="tab"
            aria-selected={tab === option.id}
            className={`inventory-subtab ${tab === option.id ? "active" : ""}`}
            onClick={() => setTab(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>

      {canWrite && (
        <CatalogCreateForm
          tab={tab}
          organizationId={organizationId}
          onCreated={() => setRevision((n) => n + 1)}
        />
      )}

      {active.error && <p className="workspace-error">{active.error}</p>}
      <ul className="inventory-chip-list">
        {tab === "categories" &&
          categories.data.map((row) => (
            <li key={row.id} className="inventory-chip">
              {row.name}
              <span className="inventory-chip-meta">{row.slug}</span>
              {canWrite && (
                <CatalogRowActions
                  kind="categories"
                  organizationId={organizationId}
                  row={row}
                  onChanged={() => setRevision((n) => n + 1)}
                />
              )}
            </li>
          ))}
        {tab === "units" &&
          units.data.map((row) => (
            <li key={row.id} className="inventory-chip">
              {row.code}
              <span className="inventory-chip-meta">{row.category}</span>
              {canWrite && (
                <CatalogRowActions
                  kind="units"
                  organizationId={organizationId}
                  row={row}
                  onChanged={() => setRevision((n) => n + 1)}
                />
              )}
            </li>
          ))}
        {tab === "suppliers" &&
          suppliers.data.map((row) => (
            <li key={row.id} className="inventory-chip">
              {row.name}
              <span className="inventory-chip-meta">{row.phone ?? row.email ?? "—"}</span>
              {canWrite && (
                <CatalogRowActions
                  kind="suppliers"
                  organizationId={organizationId}
                  row={row}
                  onChanged={() => setRevision((n) => n + 1)}
                />
              )}
            </li>
          ))}
        {tab === "conversions" &&
          conversions.data.map((row) => (
            <li key={row.id} className="inventory-chip">
              {unitLabel(row.fromUnitId)} → {unitLabel(row.toUnitId)}
              <span className="inventory-chip-meta">× {row.factor}</span>
            </li>
          ))}
      </ul>

      {!active.loading && !active.data.length && (
        <p className="inventory-empty">Nothing here yet.</p>
      )}
    </section>
  );
}

function CatalogCreateForm({
  tab,
  organizationId,
  onCreated,
}: {
  tab: Tab;
  organizationId: string;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      if (tab === "categories") {
        const slug = name
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-");
        await createCategory(organizationId, { name: name.trim(), slug });
      } else if (tab === "units") {
        await createUnit(organizationId, {
          name: name.trim(),
          code: code.trim().toLowerCase(),
          category: "count",
        });
      } else if (tab === "conversions") {
        // Handled by UnitConversionForm, which needs two selects rather than one
        // text field.
        setBusy(false);
        return;
      } else {
        await createSupplier(organizationId, { name: name.trim() });
      }
      setName("");
      setCode("");
      onCreated();
      toast.success("Saved");
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  if (tab === "conversions") {
    return <UnitConversionForm organizationId={organizationId} onCreated={onCreated} />;
  }

  return (
    <form className="inventory-create-form" onSubmit={submit}>
      <div>
        <Label htmlFor="inventory-new-name">Name</Label>
        <Input
          id="inventory-new-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          maxLength={120}
        />
      </div>
      {tab === "units" && (
        <div>
          <Label htmlFor="inventory-new-code">Code</Label>
          <Input
            id="inventory-new-code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            required
            maxLength={20}
            placeholder="kg"
          />
        </div>
      )}
      <Button type="submit" disabled={busy || !name.trim()}>
        {busy ? "Saving…" : "Add"}
      </Button>
    </form>
  );
}
