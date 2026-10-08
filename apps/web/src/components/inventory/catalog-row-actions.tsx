import { deleteCategory, updateCategory, updateSupplier, updateUnit } from "@/data/catalog";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export type CatalogKind = "categories" | "units" | "suppliers";

export interface CatalogRow {
  id: string;
  name: string;
  slug?: string;
  code?: string;
  category?: string;
  email?: string | null;
  phone?: string | null;
}

/**
 * Editing in place, because a category or unit that cannot be renamed is one a
 * seller will simply create a second copy of.
 */
export function CatalogRowActions({
  kind,
  organizationId,
  row,
  onChanged,
}: {
  kind: CatalogKind;
  organizationId: string;
  row: CatalogRow;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(row.name);
  const [code, setCode] = useState(row.code ?? "");
  const [phone, setPhone] = useState(row.phone ?? "");
  const [busy, setBusy] = useState(false);

  async function run(action: () => Promise<unknown>, message: string) {
    setBusy(true);
    try {
      await action();
      onChanged();
      toast.success(message);
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Could not save");
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <span className="catalog-inline-edit">
        <Input
          aria-label="Name"
          value={name}
          maxLength={255}
          onChange={(event) => setName(event.target.value)}
        />
        {kind === "units" && (
          <Input
            aria-label="Code"
            value={code}
            maxLength={20}
            onChange={(event) => setCode(event.target.value)}
          />
        )}
        {kind === "suppliers" && (
          <Input
            aria-label="Phone"
            value={phone}
            maxLength={40}
            onChange={(event) => setPhone(event.target.value)}
          />
        )}
        <Button
          type="button"
          size="sm"
          disabled={busy || !name.trim()}
          onClick={() =>
            void run(() => {
              if (kind === "categories") {
                return updateCategory(organizationId, row.id, {
                  name: name.trim(),
                  slug: name
                    .trim()
                    .toLowerCase()
                    .replace(/[^a-z0-9]+/g, "-"),
                });
              }
              if (kind === "units") {
                return updateUnit(organizationId, row.id, { name: name.trim(), code: code.trim() });
              }
              return updateSupplier(organizationId, row.id, {
                name: name.trim(),
                phone: phone.trim() || null,
              });
            }, "Saved.")
          }
        >
          Save
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => setEditing(false)}
        >
          Cancel
        </Button>
      </span>
    );
  }

  return (
    <span className="catalog-row-buttons">
      <Button
        type="button"
        size="sm"
        variant="ghost"
        disabled={busy}
        onClick={() => setEditing(true)}
      >
        Edit
      </Button>
      {kind === "categories" && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={busy}
          onClick={() => {
            // Products already filed under a category reference it, so removing
            // one is confirmed rather than assumed.
            if (!window.confirm(`Remove "${row.name}"? Products keep their own details.`)) return;
            void run(() => deleteCategory(organizationId, row.id), "Category removed.");
          }}
        >
          Remove
        </Button>
      )}
    </span>
  );
}
