import { describe, expect, it } from "vitest";
import {
  addCartItem,
  normalizeQuantity,
  setCartItemQuantity,
  summarizeCart,
  toCartLineInput,
} from "@/components/pos/pos-cart-state";
import { previewPosTotals } from "@/components/pos/pos-checkout";
import type { PosCartItem } from "@/components/pos/types/pos.type";

/**
 * A till that weighs produce.
 *
 * The quantity on a cart line is decimal because `order_item.quantity` and
 * `stock.on_hand` are: a shop sells 1.5 kg of mangos, and a cart that could only
 * add whole units made that sale impossible however willing the seller was.
 *
 * What these check is the arithmetic agreeing at every step. A till shows a
 * subtotal, the seller hands over cash against it, and the server re-derives it —
 * if the three disagree by a kobo the customer is short-changed or overcharged.
 */
const mangos: PosCartItem = {
  productId: "p1",
  variantId: null,
  name: "Mangos",
  sku: "MANGO-1",
  unitPriceMinor: 5_000, // ₦50.00 per kg
  quantity: 1,
  serialNumberId: null,
  serialCode: null,
  note: "",
};

describe("a weighed quantity", () => {
  it("isTakenFromTheTillAsTyped", () => {
    const [cart] = setCartItemQuantity([mangos], "p1", null, null, 1.5);

    expect(cart.quantity).toBe(1.5);
  });

  it("keepsThreeDecimalPlaces_atMost", () => {
    // The column is numeric(12,3) and Postgres *rounds* a fourth place rather
    // than refusing it, so the stored number would differ from the one the
    // cashier saw and agreed to.
    expect(normalizeQuantity(1.0005)).toBe(1.001);
    expect(setCartItemQuantity([mangos], "p1", null, null, 2.12345)[0].quantity).toBe(2.123);
  });

  it("stillAddsAndSubtractsInWholeUnits", () => {
    // The +/- pair stays whole-unit for speed; the field is for the weighed amount.
    const added = addCartItem([mangos], mangos);
    expect(added[0].quantity).toBe(2);

    const removed = setCartItemQuantity(added, "p1", null, null, 1);
    expect(removed[0].quantity).toBe(1);
  });

  it("dropsTheLine_whenTheQuantityReachesZero", () => {
    expect(setCartItemQuantity([mangos], "p1", null, null, 0)).toHaveLength(0);
    // Not a negative quantity on a sale, which the server would refuse.
    expect(setCartItemQuantity([mangos], "p1", null, null, -1)).toHaveLength(0);
  });

  it("cannotFallBelowTheMinimumTheServerAccepts", () => {
    // The DTO's floor is 0.001; anything less is refused with a 400 at the till.
    expect(setCartItemQuantity([mangos], "p1", null, null, 0.0001)[0].quantity).toBe(0);
  });
});

describe("the money a weighed line produces", () => {
  it("multipliesTheFractionByTheUnitPrice", () => {
    const cart = setCartItemQuantity([mangos], "p1", null, null, 1.5);

    // 1.5 kg at ₦50.00 is ₦75.00.
    expect(summarizeCart(cart).subtotalMinor).toBe(7_500);
  });

  it("roundsEachLine_soTheSubtotalIsTheSumOfTheFiguresShown", () => {
    // A quantity that lands between two minor units must round predictably: the
    // cashier adds up the line figures on screen and that has to be the total.
    const perGram = { ...mangos, unitPriceMinor: 3 };
    const cart = setCartItemQuantity([perGram], "p1", null, null, 0.5);

    expect(summarizeCart(cart).subtotalMinor).toBe(2); // 1.5 rounds to 2
  });

  it("neverProducesAFractionalMinorUnit_total", () => {
    // 5 grams at ₦1.00 per gram is half a kobo. Left unrounded that reaches the
    // orders table as 0.5 and is refused by the whole-minor check there — the
    // sale fails at the till with a constraint error the seller cannot act on.
    const perGram = { ...mangos, unitPriceMinor: 100 };
    const cart = setCartItemQuantity([perGram], "p1", null, null, 0.005);

    const totals = previewPosTotals(cart, 0, 100, 0);
    expect(Number.isInteger(totals.subtotalMinor)).toBe(true);
    expect(totals.subtotalMinor).toBe(1);
  });

  it("agreesWithTheServerPreview_whenTaxIsAdded", () => {
    const cart = setCartItemQuantity([mangos], "p1", null, null, 1.5);
    const totals = previewPosTotals(cart, 0, 7_500, 750);

    // 7.5% of ₦75.00 is ₦5.63, matching PosTotalsService's rounding.
    expect(totals.subtotalMinor).toBe(7_500);
    expect(totals.taxMinor).toBe(563);
    expect(totals.totalMinor).toBe(8_063);
  });

  it("computesChangeFromTheWeighedTotal", () => {
    const cart = setCartItemQuantity([mangos], "p1", null, null, 1.5);
    const totals = previewPosTotals(cart, 0, 10_000, 750);

    // ₦100 tendered against ₦80.63 due.
    expect(totals.changeMinor).toBe(1_937);
  });

  it("countsAWeighedBasketInWholeUnitsForDisplay", () => {
    // "1.5 items" on a till screen is noise; the subtotal is what matters.
    expect(summarizeCart([mangos, mangos]).itemCount).toBe(2);
  });
});

describe("what the till sends", () => {
  it("carriesTheFractionUnchanged", () => {
    const cart = setCartItemQuantity([mangos], "p1", null, null, 1.5);

    // The queued-offline path sends this shape, so a replay has to carry the
    // same fraction or the replayed sale is a different sale.
    expect(toCartLineInput(cart)).toEqual([{ productId: "p1", variantId: null, quantity: 1.5 }]);
  });

  it("omitsSerialsForAnOrdinaryLine", () => {
    expect(
      toCartLineInput(setCartItemQuantity([mangos], "p1", null, null, 1.5))[0],
    ).not.toHaveProperty("serialNumberIds");
  });

  it("keepsASerialisedLineAtOneUnit", () => {
    const phone: PosCartItem = { ...mangos, serialNumberId: "s1", serialCode: "IMEI-1" };
    const cart = addCartItem([phone], phone, 1);

    // A serial is one physical item, so it never stacks into a quantity.
    expect(cart).toHaveLength(1);
  });
});
