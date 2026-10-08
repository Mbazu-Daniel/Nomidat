import type { PosSaleResult } from "@/data/pos";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatMoney } from "@/lib/money";

/**
 * The receipt a customer is handed.
 *
 * The currency is passed in rather than assumed: this is the document the seller
 * gives the buyer, and a receipt printed in the wrong currency is the one thing
 * on a sale that cannot be quietly corrected later.
 */
export function PosReceiptDialog({
  sale,
  currency,
  onClose,
  onPrint,
}: {
  sale: PosSaleResult | null;
  currency: string;
  onClose: () => void;
  onPrint: () => void;
}) {
  return (
    <Dialog open={Boolean(sale)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="pos-receipt-dialog">
        <DialogHeader>
          <DialogTitle>Sale completed</DialogTitle>
          <DialogDescription>
            {sale?.orderNumber ? `Reference ${sale.orderNumber}.` : "Sale recorded."}
          </DialogDescription>
        </DialogHeader>

        {sale && (
          <dl className="pos-receipt-totals">
            <div>
              <dt>Subtotal</dt>
              <dd>{formatMoney(sale.posTotals.subtotalMinor, currency)}</dd>
            </div>
            {sale.posTotals.discountMinor > 0 && (
              <div>
                <dt>Discount</dt>
                <dd>−{formatMoney(sale.posTotals.discountMinor, currency)}</dd>
              </div>
            )}
            <div>
              <dt>VAT</dt>
              <dd>{formatMoney(sale.posTotals.taxMinor, currency)}</dd>
            </div>
            <div className="pos-receipt-grand">
              <dt>Total</dt>
              <dd>{formatMoney(sale.posTotals.totalMinor, currency)}</dd>
            </div>
            {sale.changeMinor > 0 && (
              <div>
                <dt>Change given</dt>
                <dd>{formatMoney(sale.changeMinor, currency)}</dd>
              </div>
            )}
            <div>
              <dt>Status</dt>
              <dd>{sale.status}</dd>
            </div>
          </dl>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onPrint}>
            Print receipt
          </Button>
          <Button type="button" onClick={onClose}>
            New sale
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
