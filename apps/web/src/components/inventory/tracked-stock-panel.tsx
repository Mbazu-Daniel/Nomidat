import { useState } from "react";
import { BatchRegisterForm } from "./batch-register-form";
import { BatchesPanel } from "./batches-panel";
import { SerialRegisterForm } from "./serial-register-form";
import { SerialsPanel } from "./serials-panel";

type Tab = "serials" | "batches";

const TABS: { id: Tab; label: string }[] = [
  { id: "serials", label: "Serial numbers" },
  { id: "batches", label: "Batches" },
];

/**
 * Stock tracked one unit at a time. A serial is a specific physical item — a
 * phone's IMEI — and a batch is a lot of the same thing that runs down together.
 */
export function TrackedStockPanel({
  organizationId,
  canWrite,
}: {
  organizationId: string;
  canWrite: boolean;
}) {
  const [tab, setTab] = useState<Tab>("serials");
  const [revision, setRevision] = useState(0);
  const refresh = () => setRevision((n) => n + 1);

  return (
    <section className="inventory-panel">
      <div className="inventory-subtabs" role="tablist" aria-label="Tracked stock">
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

      {canWrite &&
        (tab === "serials" ? (
          <SerialRegisterForm
            key={`serials-${revision}`}
            organizationId={organizationId}
            onCreated={refresh}
          />
        ) : (
          <BatchRegisterForm
            key={`batches-${revision}`}
            organizationId={organizationId}
            onCreated={refresh}
          />
        ))}

      {tab === "serials" ? (
        <SerialsPanel key={revision} organizationId={organizationId} canWrite={canWrite} />
      ) : (
        <BatchesPanel key={revision} organizationId={organizationId} canWrite={canWrite} />
      )}
    </section>
  );
}
