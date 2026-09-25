import { createFileRoute } from "@tanstack/react-router";
import { SaleReceipt } from "@/components/workspace/sale-receipt";
export const Route = createFileRoute("/receipts/$organizationId/$saleId")({
  component: ReceiptPage,
});
function ReceiptPage() {
  const { organizationId, saleId } = Route.useParams();
  return <SaleReceipt organizationId={organizationId} saleId={saleId} />;
}
