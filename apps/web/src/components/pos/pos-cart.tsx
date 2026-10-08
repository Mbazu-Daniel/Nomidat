import { removeCartItem, setCartItemQuantity } from "./pos-cart-state";
import type { PosCartItem } from "./types/pos.type";
import "./pos.css";
import { Button } from "@/components/ui/button";
import { IconMinus, IconPlus, IconTrash } from "@tabler/icons-react";
import { formatMoney } from "@/lib/money";

/**
 * The quantity a seller would actually type, not the number stored.
 *
 * Trailing zeros are dropped because "1.50 kg" reads as a weighing-machine value
 * while "1.5 kg" reads as what the seller meant. A whole quantity stays whole.
 */
function displayQuantity(quantity: number): string {
  return String(Number(quantity.toFixed(3)));
}

export function PosCart({
  items,
  subtotalMinor,
  currency,
  onChange,
  onCheckout,
}: {
  items: PosCartItem[];
  subtotalMinor: number;
  currency: string;
  onChange: (items: PosCartItem[]) => void;
  onCheckout: () => void;
}) {
  return (
    <aside className="pos-cart" aria-label="Current sale">
      <h2 className="pos-cart-title">Current sale</h2>
      {!items.length ? (
        <p className="pos-cart-empty">Tap a product to start a sale.</p>
      ) : (
        <ul className="pos-cart-lines">
          {items.map((item) => (
            <li
              key={`${item.productId}:${item.variantId ?? ""}:${item.serialNumberId ?? ""}`}
              className="pos-cart-line"
            >
              <div className="pos-cart-line-detail">
                <strong>{item.name}</strong>
                {item.sku && <span className="pos-cart-line-sku">{item.sku}</span>}
                {item.serialCode && (
                  <span className="pos-cart-line-serial">Serial {item.serialCode}</span>
                )}
                <span>{formatMoney(item.unitPriceMinor, currency)} each</span>
              </div>
              <div className="pos-cart-line-controls">
                {item.serialNumberId ? (
                  <span className="pos-cart-line-quantity">1 unit</span>
                ) : (
                  <>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label={`Decrease ${item.name}`}
                      onClick={() =>
                        onChange(
                          setCartItemQuantity(
                            items,
                            item.productId,
                            item.variantId,
                            null,
                            item.quantity - 1,
                          ),
                        )
                      }
                    >
                      <IconMinus size={16} />
                    </Button>
                    {/*
                      A typed quantity, because a till weighing produce cannot add
                      half a kilo with a +/- pair. `inputMode="decimal"` puts a
                      numeric keypad up on a phone, which is where a till actually
                      runs. Stepping the decrement by 1 keeps whole-unit stock fast;
                      the field is how a weighed amount is entered.
                    */}
                    <input
                      className="pos-cart-line-quantity"
                      type="number"
                      inputMode="decimal"
                      min="0"
                      step="0.001"
                      aria-label={`${item.name} quantity`}
                      value={displayQuantity(item.quantity)}
                      onChange={(event) =>
                        onChange(
                          setCartItemQuantity(
                            items,
                            item.productId,
                            item.variantId,
                            null,
                            Number(event.target.value),
                          ),
                        )
                      }
                    />
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label={`Increase ${item.name}`}
                      onClick={() =>
                        onChange(
                          setCartItemQuantity(
                            items,
                            item.productId,
                            item.variantId,
                            null,
                            item.quantity + 1,
                          ),
                        )
                      }
                    >
                      <IconPlus size={16} />
                    </Button>
                  </>
                )}
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label={`Remove ${item.name}`}
                  onClick={() =>
                    onChange(
                      removeCartItem(items, item.productId, item.variantId, item.serialNumberId),
                    )
                  }
                >
                  <IconTrash size={16} />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className="pos-cart-total">
        <span>Subtotal</span>
        <strong>{formatMoney(subtotalMinor, currency)}</strong>
      </div>
      <Button
        type="button"
        className="pos-cart-checkout"
        disabled={!items.length}
        onClick={onCheckout}
      >
        Charge sale
      </Button>
    </aside>
  );
}
