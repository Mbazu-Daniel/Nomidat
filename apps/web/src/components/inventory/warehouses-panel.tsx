import { createWarehouse, getWarehouses, updateWarehouse, type Warehouse } from "@/data/inventory";
import { useAsyncResource } from "@/lib/use-api-resource";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";

/** The places stock is held. Every stock line belongs to one of these. */
export function WarehousesPanel({
  organizationId,
  canWrite,
}: {
  organizationId: string;
  canWrite: boolean;
}) {
  const [revision, setRevision] = useState(0);
  const { data, loading, error } = useAsyncResource<Warehouse[]>(
    getWarehouses,
    organizationId,
    [],
    revision,
  );

  return (
    <section className="inventory-panel">
      {canWrite && (
        <WarehouseForm
          organizationId={organizationId}
          onCreated={() => setRevision((n) => n + 1)}
        />
      )}

      {error && <p className="workspace-error">{error}</p>}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Code</TableHead>
            <TableHead>Kind</TableHead>
            <TableHead>Phone</TableHead>
            {canWrite && <TableHead>Edit</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => (
            <TableRow key={row.id}>
              <TableCell>
                {row.name}
                {row.isDefault && <span className="inventory-chip-meta"> default</span>}
              </TableCell>
              <TableCell>{row.code}</TableCell>
              <TableCell>{row.kind}</TableCell>
              <TableCell>{row.phone ?? "—"}</TableCell>
              {canWrite && (
                <TableCell>
                  <WarehouseRowEditor
                    organizationId={organizationId}
                    row={row}
                    onChanged={() => setRevision((n) => n + 1)}
                  />
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {!loading && !data.length && <p className="inventory-empty">No warehouses yet.</p>}
    </section>
  );
}

/** A warehouse's name and phone are wrong sooner or later; make them fixable. */
function WarehouseRowEditor({
  organizationId,
  row,
  onChanged,
}: {
  organizationId: string;
  row: Warehouse;
  onChanged: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(row.name);
  const [phone, setPhone] = useState(row.phone ?? "");
  const [busy, setBusy] = useState(false);

  if (!editing) {
    return (
      <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(true)}>
        Edit
      </Button>
    );
  }

  return (
    <span className="catalog-inline-edit">
      <Input
        aria-label="Name"
        value={name}
        maxLength={120}
        onChange={(event) => setName(event.target.value)}
      />
      <Input
        aria-label="Phone"
        value={phone}
        maxLength={40}
        onChange={(event) => setPhone(event.target.value)}
      />
      <Button
        type="button"
        size="sm"
        disabled={busy || !name.trim()}
        onClick={() => {
          setBusy(true);
          void updateWarehouse(organizationId, row.id, {
            name: name.trim(),
            phone: phone.trim() || null,
          })
            .then(() => {
              onChanged();
              setEditing(false);
            })
            .catch((reason: Error) =>
              toast.error(reason instanceof Error ? reason.message : "Could not save"),
            )
            .finally(() => setBusy(false));
        }}
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

function WarehouseForm({
  organizationId,
  onCreated,
}: {
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
      await createWarehouse(organizationId, { name: name.trim(), code: code.trim() });
      setName("");
      setCode("");
      onCreated();
      toast.success("Warehouse added");
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Could not add warehouse");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="inventory-create-form" onSubmit={submit}>
      <div>
        <Label htmlFor="warehouse-name">Name</Label>
        <Input
          id="warehouse-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          maxLength={120}
          placeholder="Main store"
        />
      </div>
      <div>
        <Label htmlFor="warehouse-code">Code</Label>
        <Input
          id="warehouse-code"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          required
          maxLength={20}
          placeholder="MAIN"
        />
      </div>
      <Button type="submit" disabled={busy || !name.trim() || !code.trim()}>
        {busy ? "Adding…" : "Add warehouse"}
      </Button>
    </form>
  );
}
