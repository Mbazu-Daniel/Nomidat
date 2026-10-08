import { formatMoney, parseMoneyToMinor } from "@/lib/money";
import { POS_PAYMENT_METHODS, type PosCartItem, type PosPaymentMethod } from "./types/pos.type";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";

/** Mirrors the server's VAT basis points so the cashier's preview matches the receipt. */

export interface PosCheckoutTotals {
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  totalMinor: number;
  changeMinor: number;
}

export function previewPosTotals(
  items: PosCartItem[],
  discountMinor: number,
  tenderedMinor: number,
  taxRateBps: number,
) {
  // Rounded per line, matching PosTotalsService on the server. A weighed line can
  // land between two minor units, and rounding only the sum here would leave the
  // cashier paying a figure that does not match the lines they just read.
  const subtotalMinor = items.reduce(
    (total, item) => total + Math.round(item.quantity * item.unitPriceMinor),
    0,
  );
  const applied = Math.min(Math.max(discountMinor, 0), subtotalMinor);
  const taxMinor = Math.round(((subtotalMinor - applied) * taxRateBps) / 10_000);
  const totalMinor = subtotalMinor - applied + taxMinor;

  return {
    subtotalMinor,
    discountMinor: applied,
    taxMinor,
    totalMinor,
    changeMinor: Math.max(0, tenderedMinor - totalMinor),
  };
}

/**
 * The tendered amount, in the currency's own minor units.
 *
 * The scale comes from the currency rather than a fixed hundred, because a till
 * selling in yen cannot express an amount with hundredths and a fixed 100 would
 * silently multiply every tender by 100.
 */
function toMinor(amount: string, currency: string) {
  const parsed = parseMoneyToMinor(amount, currency);
  return parsed ?? 0;
}

export function PosCheckoutDialog({
  open,
  items,
  contactId,
  busy,
  currency,
  taxRateBps,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  items: PosCartItem[];
  contactId: string;
  busy: boolean;
  currency: string;
  taxRateBps: number;
  onOpenChange: (open: boolean) => void;
  onConfirm: (input: {
    discountMinor: number;
    tenderedMinor: number;
    paymentMethod: PosPaymentMethod;
  }) => void;
}) {
  const [method, setMethod] = useState<PosPaymentMethod>("cash");
  const [discount, setDiscount] = useState("");
  const [tendered, setTendered] = useState("");

  const totals = previewPosTotals(
    items,
    toMinor(discount, currency),
    toMinor(tendered, currency),
    taxRateBps,
  );
  const short = toMinor(tendered, currency) < totals.totalMinor;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="pos-checkout-dialog">
        <DialogHeader>
          <DialogTitle>Take payment</DialogTitle>
          <DialogDescription>
            Amounts are recalculated and confirmed by the server when you charge the sale.
          </DialogDescription>
        </DialogHeader>

        <div className="pos-checkout-methods" role="group" aria-label="Payment method">
          {POS_PAYMENT_METHODS.map((option) => (
            <Button
              key={option.value}
              type="button"
              variant={method === option.value ? "default" : "outline"}
              aria-pressed={method === option.value}
              onClick={() => setMethod(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>

        <div className="pos-checkout-fields">
          <div>
            <Label htmlFor="pos-discount">Discount</Label>
            <Input
              id="pos-discount"
              inputMode="decimal"
              value={discount}
              onChange={(event) => setDiscount(event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="pos-tendered">Amount tendered</Label>
            <Input
              id="pos-tendered"
              inputMode="decimal"
              value={tendered}
              onChange={(event) => setTendered(event.target.value)}
            />
          </div>
        </div>

        <dl className="pos-checkout-totals">
          <div>
            <dt>Subtotal</dt>
            <dd>{formatMoney(totals.subtotalMinor, currency)}</dd>
          </div>
          <div>
            <dt>Discount</dt>
            <dd>−{formatMoney(totals.discountMinor, currency)}</dd>
          </div>
          <div>
            <dt>Tax ({(taxRateBps / 100).toFixed(2)}%)</dt>
            <dd>{formatMoney(totals.taxMinor, currency)}</dd>
          </div>
          <div className="pos-checkout-grand">
            <dt>Total due</dt>
            <dd>{formatMoney(totals.totalMinor, currency)}</dd>
          </div>
          {!short && toMinor(tendered, currency) > 0 && (
            <div>
              <dt>Change</dt>
              <dd>{formatMoney(totals.changeMinor, currency)}</dd>
            </div>
          )}
        </dl>

        {contactId && <p className="pos-checkout-contact">Charged to the selected contact.</p>}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={busy || !items.length || short}
            onClick={() =>
              onConfirm({
                discountMinor: totals.discountMinor,
                tenderedMinor: toMinor(tendered, currency),
                paymentMethod: method,
              })
            }
          >
            {busy ? "Charging…" : "Charge sale"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
