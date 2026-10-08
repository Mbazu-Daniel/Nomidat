import { createFileRoute } from "@tanstack/react-router";
import { useOrgContext } from "@/components/shell/org-context";
import { PosTerminal } from "@/components/pos/pos-terminal";
import { canWriteArea } from "@/components/workspace/staff-permissions";

export const Route = createFileRoute("/$orgSlug/pos")({
  component: PosPage,
});

function PosPage() {
  const { organization, role } = useOrgContext();
  return (
    <div className="workspace-page">
      <header className="workspace-page-header">
        <div>
          <h1>Point of sale</h1>
          <p>Ring up a sale, take payment and print a receipt.</p>
        </div>
      </header>
      <PosTerminal
        key={organization.id}
        organizationId={organization.id}
        canCheckout={canWriteArea(role, "sales")}
      />
    </div>
  );
}
