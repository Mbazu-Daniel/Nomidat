import { describe, expect, it } from "vitest";
import {
  addCartItem,
  setCartItemNote,
  toCartLineInput,
} from "@/components/pos/pos-cart-state";
import type { PosCartItem } from "@/components/pos/types/pos.type";

/**
 * Per-line kitchen instructions.
 *
 * A note that is dropped rather than stored is a meal prepared wrong and charged
 * for, so what these check is that a note survives the whole path: typed into
 * one line, still there when the quantity changes, and actually sent to the
 * server. Two failures prompted this — re-tapping a product to raise its
 * quantity wiped the note, and a blank note was being sent as an empty string
 * rather than omitted.
 */
const jollof: PosCartItem = {
  productId: "p1",
  variantId: null,
  name: "Jollof",
  sku: "JOL-1",
  unitPriceMinor: 3_500,
  quantity: 1,
  serialNumberId: null,
  serialCode: null,
  note: "",
};

describe("cart line notes", () => {
  it("starts with no note", () => {
    expect(toCartLineInput([jollof])[0].note).toBeUndefined();
  });

  it("keeps a note when the quantity is raised by tapping the product again", () => {
    const withNote = setCartItemNote([jollof], "p1", null, null, "extra spicy");
    const afterTapping = addCartItem(withNote, jollof);

    expect(afterTapping[0].quantity).toBe(2);
    expect(afterTapping[0].note).toBe("extra spicy");
  });

  it("sends a written note to the server", () => {
    const cart = setCartItemNote([jollof], "p1", null, null, "no onions");
    expect(toCartLineInput(cart)[0].note).toBe("no onions");
  });

  it("omits a blank note rather than sending an empty string", () => {
    // An empty string would be stored as a note that reads as blank on the
    // kitchen ticket, indistinguishable from a real instruction.
    const blank = setCartItemNote([jollof], "p1", null, null, "   ");
    expect(toCartLineInput(blank)[0]).not.toHaveProperty("note");
  });

  it("trims a note before sending it", () => {
    const padded = setCartItemNote([jollof], "p1", null, null, "  extra spicy  ");
    expect(toCartLineInput(padded)[0].note).toBe("extra spicy");
  });

  it("leaves other lines' notes alone", () => {
    const rice: PosCartItem = { ...jollof, productId: "p2", name: "Rice" };
    const cart = setCartItemNote([jollof, rice], "p1", null, null, "extra spicy");

    expect(cart[0].note).toBe("extra spicy");
    expect(cart[1].note).toBe("");
  });

  it("keeps two variants of one product's notes apart", () => {
    // Two variants are two separate lines, so a note on one must not appear on
    // the other or the kitchen cooks the wrong dish.
    const large: PosCartItem = { ...jollof, variantId: "v-large", name: "Jollof · large" };
    const cart = setCartItemNote([jollof, large], "p1", "v-large", null, "well done");

    expect(cart[0].note).toBe("");
    expect(cart[1].note).toBe("well done");
  });
});
