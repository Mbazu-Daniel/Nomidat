import { createUnitConversion, getUnits, type UnitOfMeasure } from "@/data/catalog";
import { useAsyncResource } from "@/lib/use-api-resource";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

/**
 * How many of one unit make one of another.
 *
 * The factor belongs to the pair rather than to either unit — a kilogram is a
 * thousand grams, but that says nothing about a litre.
 */
export function UnitConversionForm({
  organizationId,
  onCreated,
}: {
  organizationId: string;
  onCreated: () => void;
}) {
  const units = useAsyncResource<UnitOfMeasure[]>(getUnits, organizationId, [], 0);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [factor, setFactor] = useState("");
  const [busy, setBusy] = useState(false);
  const value = Number(factor);

  const ready = from !== "" && to !== "" && from !== to && Number.isFinite(value) && value > 0;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ready) return;
    setBusy(true);
    try {
      await createUnitConversion(organizationId, {
        fromUnitId: from,
        toUnitId: to,
        factor: value,
      });
      setFrom("");
      setTo("");
      setFactor("");
      onCreated();
      toast.success("Conversion added.");
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="inventory-create-form" onSubmit={submit}>
      <div>
        <Label htmlFor="conversion-from">From</Label>
        <select
          id="conversion-from"
          value={from}
          onChange={(event) => setFrom(event.target.value)}
          required
        >
          <option value="">Choose a unit…</option>
          {units.data.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unit.code}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor="conversion-to">To</Label>
        <select
          id="conversion-to"
          value={to}
          onChange={(event) => setTo(event.target.value)}
          required
        >
          <option value="">Choose a unit…</option>
          {units.data.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unit.code}
            </option>
          ))}
        </select>
      </div>
      <div>
        <Label htmlFor="conversion-factor">How many per one</Label>
        <Input
          id="conversion-factor"
          type="number"
          min="0"
          step="0.000001"
          inputMode="decimal"
          value={factor}
          onChange={(event) => setFactor(event.target.value)}
          required
          placeholder="1000"
        />
      </div>
      <Button type="submit" disabled={busy || !ready}>
        {busy ? "Saving…" : "Add conversion"}
      </Button>
    </form>
  );
}
