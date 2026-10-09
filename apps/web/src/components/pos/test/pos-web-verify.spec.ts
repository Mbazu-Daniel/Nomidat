import { describe, expect, it, vi } from "vitest";
import { replayQueuedPosSales } from "@/lib/offline/pos-replay";
import { createMemoryQueueStore, type QueuedPosSale } from "@/lib/offline/pos-queue";
import {
  addCartItem,
  removeCartItem,
  setCartItemQuantity,
  summarizeCart,
  toCartLineInput,
} from "@/components/pos/pos-cart-state";
import type { PosCartItem } from "@/components/pos/types/pos.type";

const rice: PosCartItem = {
  productId: "p1",
  variantId: null,
  name: "Rice",
  sku: "RICE-1",
  unitPriceMinor: 500_000,
  quantity: 1,
  serialNumberId: null,
  serialCode: null,
  note: "",
};
const beans: PosCartItem = {
  productId: "p2",
  variantId: null,
  name: "Beans",
  sku: null,
  unitPriceMinor: 400_000,
  quantity: 2,
  serialNumberId: null,
  serialCode: null,
  note: "",
};

describe("offline replay is ordered and failure-safe", () => {
  it("submits queued sales oldest first and clears them once accepted", async () => {
    const store = createMemoryQueueStore();
    store.entries.push(
      { id: "q1", organizationId: "shop", payload: { n: 1 }, createdAt: 100 },
      { id: "q2", organizationId: "shop", payload: { n: 2 }, createdAt: 200 },
    );
    const submitted: string[] = [];

    const result = await replayQueuedPosSales(store, "shop", async (entry) => {
      submitted.push(entry.id);
    });

    expect(submitted).toEqual(["q1", "q2"]);
    expect(result).toEqual({ replayed: 2, remaining: 0 });
    expect(store.entries).toHaveLength(0);
  });

  it("halts at the first failure so a later sale cannot settle ahead of it", async () => {
    const store = createMemoryQueueStore();
    store.entries.push(
      { id: "q1", organizationId: "shop", payload: {}, createdAt: 100 },
      { id: "q2", organizationId: "shop", payload: {}, createdAt: 200 },
    );

    const result = await replayQueuedPosSales(store, "shop", async (entry) => {
      if (entry.id === "q1") throw new Error("Insufficient stock");
    });

    expect(result.replayed).toBe(0);
    expect(result.remaining).toBe(2);
    expect(store.entries.map((entry) => entry.id)).toEqual(["q1", "q2"]);
  });

  it("leaves another organization's queue untouched", async () => {
    const store = createMemoryQueueStore();
    store.entries.push({ id: "other", organizationId: "another", payload: {}, createdAt: 1 });
    store.entries.push({ id: "mine", organizationId: "shop", payload: {}, createdAt: 2 });

    await replayQueuedPosSales(store, "shop", async () => {});

    expect(store.entries.map((entry) => entry.id)).toEqual(["other"]);
  });

  it("replays the same payload so the idempotency key survives the queue", async () => {
    const store = createMemoryQueueStore();
    store.entries.push({
      id: "q1",
      organizationId: "shop",
      payload: { clientReference: "abc-123" },
      createdAt: 1,
    });
    const submit = vi.fn(async (..._args: unknown[]) => {});

    await replayQueuedPosSales(store, "shop", submit);

    expect((submit.mock.calls[0][0] as QueuedPosSale).payload).toEqual({
      clientReference: "abc-123",
    });
  });
});

describe("terminal cart", () => {
  it("increments an existing line instead of duplicating the product", () => {
    const cart = addCartItem([rice, beans], rice);
    expect(cart).toHaveLength(2);
    expect(cart[0].quantity).toBe(2);
  });

  it("drops a line when its quantity reaches zero", () => {
    expect(setCartItemQuantity([rice, beans], "p1", null, null, 0)).toEqual([beans]);
  });

  it("removes only the requested line", () => {
    expect(removeCartItem([rice, beans], "p1", null, null)).toEqual([beans]);
  });

  it("sums units and minor amounts, and reports zeroes rather than NaN when empty", () => {
    expect(summarizeCart([rice, beans])).toEqual({ itemCount: 3, subtotalMinor: 1_300_000 });
    expect(summarizeCart([])).toEqual({ itemCount: 0, subtotalMinor: 0 });
  });

  it("sends identity and quantity only, so a price cannot be tampered with", () => {
    expect(Object.keys(toCartLineInput([rice])[0]).sort()).toEqual([
      "productId",
      "quantity",
      "variantId",
    ]);
  });

  it("keeps two variants of one product as separate cart lines", () => {
    const large: PosCartItem = { ...rice, variantId: "v-large", name: "Rice · Large" };
    const small: PosCartItem = { ...rice, variantId: "v-small", name: "Rice · Small" };

    const cart = addCartItem(addCartItem([rice], large), small);
    expect(cart).toHaveLength(3);

    // Incrementing one variant must not touch the other or the plain product.
    const bumped = addCartItem(cart, large);
    expect(bumped.find((item) => item.variantId === "v-large")?.quantity).toBe(2);
    expect(bumped.find((item) => item.variantId === "v-small")?.quantity).toBe(1);
  });

  it("keeps two serialised units of one product as separate lines", () => {
    const first: PosCartItem = {
      ...rice,
      serialNumberId: "s-111",
      serialCode: "IMEI-111",
    };
    const second: PosCartItem = {
      ...rice,
      serialNumberId: "s-222",
      serialCode: "IMEI-222",
    };

    // Adding the same unit twice must not become a quantity of two, or the sale
    // would claim one serial for two phones.
    const cart = addCartItem(addCartItem([rice], first), first);
    expect(cart).toHaveLength(2);
    expect(cart.find((item) => item.serialNumberId === "s-111")?.quantity).toBe(1);

    const both = addCartItem(cart, second);
    expect(both).toHaveLength(3);
    expect(both.filter((item) => item.serialNumberId !== null)).toHaveLength(2);
  });

  it("names the serial on the sale so the API can claim it against the order", () => {
    const phone: PosCartItem = {
      ...rice,
      serialNumberId: "s-111",
      serialCode: "IMEI-111",
    };

    expect(toCartLineInput([phone])[0].serialNumberIds).toEqual(["s-111"]);
    // An ordinary line sends no serial field at all, so an untracked product
    // cannot accidentally inherit a serial from a neighbouring line.
    expect(Object.keys(toCartLineInput([rice])[0]).sort()).toEqual([
      "productId",
      "quantity",
      "variantId",
    ]);
  });
});
