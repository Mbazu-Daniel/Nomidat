import { formatMoney } from "@/lib/money";
import { useState } from "react";
import { toast } from "sonner";
import {
  addToStoreCart,
  getStoreProducts,
  checkoutStoreCart,
  type StoreCart,
  type StorefrontConfig,
  type StoreProduct,
} from "@/data/storefront";
import { clearCartToken, resumeCart } from "@/lib/storefront-cart";
import { useApiResource } from "@/lib/use-api-resource";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
// EMPTY_STOREFRONT_CONFIG lives with the type it satisfies, not with the theme
// helper that consumes it.
import { EMPTY_STOREFRONT_CONFIG } from "@/data/storefront";
import { storefrontThemeStyle } from "./storefront-theme";
import "./storefront.css";

/** Basket and checkout. The token handling lives in lib/storefront-cart so the
 * product page and this page share one definition of the storage key. */
export function StorefrontCheckout({ slug }: { slug: string }) {
  const [cart, setCart] = useState<StoreCart | null>(null);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [placed, setPlaced] = useState<string | null>(null);

  const config = useApiResource<StorefrontConfig>(
    `/public/storefront/${slug}/config`,
    EMPTY_STOREFRONT_CONFIG,
  );
  const theme = storefrontThemeStyle(config.data.theme);

  async function start() {
    setCart(await resumeCart(slug));
    setProducts(await getStoreProducts(slug));
  }

  async function add(product: StoreProduct) {
    if (!cart) return;
    setCart(await addToStoreCart(slug, cart.token, product.id, 1));
  }

  async function placeOrder() {
    if (!cart) return;
    setBusy(true);
    try {
      const result = await checkoutStoreCart(slug, {
        cartToken: cart.token,
        customerName: name || undefined,
        customerPhone: phone || undefined,
        deliveryAddress: address || undefined,
      });
      clearCartToken();
      setPlaced(result.orderId);
    } catch (reason) {
      toast.error(reason instanceof Error ? reason.message : "Could not place your order");
    } finally {
      setBusy(false);
    }
  }

  if (placed) {
    return (
      <main className="storefront" style={theme}>
        <h1>Thank you</h1>
        <p className="storefront-note">We have your order and will be in touch.</p>
      </main>
    );
  }

  return (
    <main className={`storefront storefront-${config.data.template}`} style={theme}>
      <h1>Your basket</h1>

      {!cart ? (
        <Button type="button" onClick={start}>
          Start shopping
        </Button>
      ) : (
        <div className="storefront-basket">
          {cart.items.map((item) => (
            <div key={item.id} className="storefront-basket-line">
              <span>
                {item.productName} × {item.quantity}
              </span>
              <strong>{formatMoney(item.quantity * item.unitPriceMinor, cart.currency)}</strong>
            </div>
          ))}

          <div className="storefront-total">
            <span>Total</span>
            <span>{formatMoney(cart.totalMinor, cart.currency)}</span>
          </div>

          <div>
            <Label htmlFor="store-name">Your name</Label>
            <Input id="store-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="store-phone">Phone</Label>
            <Input
              id="store-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
            />
          </div>
          <div>
            <Label htmlFor="store-address">Delivery address</Label>
            <Input
              id="store-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </div>

          <Button type="button" disabled={busy || !cart.items.length} onClick={placeOrder}>
            {busy ? "Placing order…" : "Place order"}
          </Button>

          <h2>Add more</h2>
          <ul className="storefront-grid">
            {products
              .filter((product) => product.inStock)
              .map((product) => (
                <li key={product.id} className="storefront-card">
                  <h3>{product.name}</h3>
                  <p className="storefront-price">
                    {formatMoney(product.priceMinor, cart?.currency ?? "NGN")}
                  </p>
                  <Button type="button" size="sm" onClick={() => add(product)}>
                    Add
                  </Button>
                </li>
              ))}
          </ul>
        </div>
      )}
    </main>
  );
}
